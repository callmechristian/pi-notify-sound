/**
 * pi-notify-sound — event wiring.
 *
 * Proven signals (kept as local constants so the extension stays zero-dep):
 *  - "agent_settled"          pi lifecycle — agent fully done, no retry/
 *                             compaction/follow-up left. (agent_end fires
 *                             too early; retries may still follow.)
 *  - "rpiv:ask-user:prompt"   from @juicesharp/rpiv-ask-user-question, emitted
 *                             while a questionnaire awaits user input. Channel
 *                             is immutable per that package's stability policy.
 *  - "permissions:ui_prompt"  from @gotgenes/pi-permission-system, emitted
 *                             immediately before a permission prompt a human
 *                             must answer. Package may not be installed; the
 *                             listener is then a harmless no-op.
 *  - "tool_execution_end"     pi tool lifecycle — plays the error sound when
 *                             a tool call fails (isError).
 *  - "session_shutdown"       pi lifecycle — opt-in session-end sound.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadEffectiveConfig, resolveEventSound } from "./config.js";
import { isWindowFocused } from "./focus.js";
import { playSound } from "./sound.js";
import type { NotifyEventKey } from "./types.js";

const ASK_USER_PROMPT_EVENT = "rpiv:ask-user:prompt" as const;
const PERMISSION_UI_PROMPT_EVENT = "permissions:ui_prompt" as const;

/** Unsubscribe functions for pi.events.on listeners (EventBus survives reloads). */
let unsubs: Array<() => void> = [];

/** Project dir for per-project config; set at session_start when trusted. */
let sessionCwd: string | undefined;

/** Global dedupe — Date.now() of the last sound that actually played. */
let lastPlayedAt = 0;

function clearEventBusListeners(): void {
	for (const unsub of unsubs) {
		try {
			unsub();
		} catch {
			/* ignore */
		}
	}
	unsubs = [];
}

/** Set the project dir (for per-project config). Called at session_start. */
export function setSessionCwd(cwd: string | undefined): void {
	sessionCwd = cwd;
}

/** Reset the cooldown clock and cwd (test support + fresh registration). */
export function resetPlaybackState(): void {
	lastPlayedAt = 0;
	sessionCwd = undefined;
}

/**
 * Stop reasons meaning the RUN itself was interrupted (breaking) — provider
 * timeout/error → "error", user/model stop → "aborted". A failed tool call
 * (wrong bash command) does NOT produce these; the run keeps going.
 */
const BREAKING_STOP_REASONS: ReadonlySet<string> = new Set([
	"error",
	"aborted",
]);

/** The breaking stop reason of the final assistant message, or null. */
function breakingStopReason(messages: unknown): string | null {
	if (!Array.isArray(messages)) return null;
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i] as { role?: string; stopReason?: string };
		if (m?.role !== "assistant") continue;
		return typeof m.stopReason === "string" &&
			BREAKING_STOP_REASONS.has(m.stopReason)
			? m.stopReason
			: null;
	}
	return null;
}

/** Play the sound configured for an event key, respecting cooldown + focus. */
async function playFor(eventKey: NotifyEventKey): Promise<void> {
	try {
		const config = loadEffectiveConfig(sessionCwd);
		if (!config.sound) return;
		const path = resolveEventSound(config, eventKey);
		if (!path) return;
		const now = Date.now();
		if (
			config.cooldown_ms > 0 &&
			lastPlayedAt !== 0 &&
			now - lastPlayedAt < config.cooldown_ms
		) {
			return;
		}
		if (config.suppressWhenFocused && (await isWindowFocused())) return;
		lastPlayedAt = now;
		playSound(path);
	} catch {
		// Never let sound wiring break the event loop.
	}
}

/** Register all listeners. Safe to call on every extension (re)load. */
export function wireEvents(pi: ExtensionAPI): void {
	clearEventBusListeners();
	resetPlaybackState();

	// Agent fully settled — no automatic retry/compaction/follow-up pending.
	pi.on("agent_settled", () => void playFor("agent_settled"));

	// Questionnaire awaiting user input.
	unsubs.push(
		pi.events.on(ASK_USER_PROMPT_EVENT, () => void playFor("ask_user_prompt")),
	);

	// Permission prompt awaiting a human decision (if that extension is present).
	unsubs.push(
		pi.events.on(
			PERMISSION_UI_PROMPT_EVENT,
			() => void playFor("permission_request"),
		),
	);

	// Tool failures — the error sound. Fires after every failed tool call.
	pi.on("tool_execution_end", (event) => {
		if ((event as { isError?: boolean }).isError) void playFor("tool_error");
	});

	// Breaking interrupts — the run itself stopped with error/abort (provider
	// timeout, model stopped), not a failed tool call. Cooldown dedupes
	// auto-retry noise.
	pi.on("agent_end", (event) => {
		if (breakingStopReason((event as { messages?: unknown }).messages)) {
			void playFor("breaking_error");
		}
	});

	// Session end — opt-in (session_shutdown defaults to null).
	pi.on("session_shutdown", () => void playFor("session_shutdown"));
}

/** Called on session_shutdown to release pi.events.on listeners. */
export function unwireEvents(): void {
	clearEventBusListeners();
}
