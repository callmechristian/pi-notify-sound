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
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig, resolveEventSound } from "./config.js";
import { playSound } from "./sound.js";
import type { NotifyEventKey } from "./types.js";

const ASK_USER_PROMPT_EVENT = "rpiv:ask-user:prompt" as const;
const PERMISSION_UI_PROMPT_EVENT = "permissions:ui_prompt" as const;

/** Unsubscribe functions for pi.events.on listeners (EventBus survives reloads). */
let unsubs: Array<() => void> = [];

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

/** Play the sound configured for an event key. Reads config at fire-time. */
function playFor(eventKey: NotifyEventKey): void {
	try {
		const config = loadConfig();
		const path = resolveEventSound(config, eventKey);
		if (path) playSound(path);
	} catch {
		// Never let sound wiring break the event loop.
	}
}

/** Register all listeners. Safe to call on every extension (re)load. */
export function wireEvents(pi: ExtensionAPI): void {
	clearEventBusListeners();

	// Agent fully settled — no automatic retry/compaction/follow-up pending.
	pi.on("agent_settled", () => playFor("agent_settled"));

	// Questionnaire awaiting user input.
	unsubs.push(
		pi.events.on(ASK_USER_PROMPT_EVENT, () => playFor("ask_user_prompt")),
	);

	// Permission prompt awaiting a human decision (if that extension is present).
	unsubs.push(
		pi.events.on(PERMISSION_UI_PROMPT_EVENT, () =>
			playFor("permission_request"),
		),
	);

	// Tool failures — the error sound. Fires after every failed tool call.
	pi.on("tool_execution_end", (event) => {
		if ((event as { isError?: boolean }).isError) playFor("tool_error");
	});
}

/** Called on session_shutdown to release pi.events.on listeners. */
export function unwireEvents(): void {
	clearEventBusListeners();
}