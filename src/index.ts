/**
 * pi-notify-sound — a pi extension that plays a sound when the agent finishes
 * and when it waits for your input (questions, permission prompts).
 *
 * Config: ~/.pi/notify-sound/config.json + optional <cwd>/.pi/notify-sound.json
 *   per-event sound: "default" (bundled) | null (disabled) | <wav path>
 *   cooldown_ms (dedupe), suppressWhenFocused (Windows), sound (master)
 * Test:   /notify-sound test [event|path]
 */

import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	ALL_EVENT_KEYS,
	CONFIG_PATH,
	ensureConfigFile,
	loadEffectiveConfig,
	resolveEventSound,
} from "./config.js";
import {
	resetPlaybackState,
	setSessionCwd,
	unwireEvents,
	wireEvents,
} from "./events.js";
import { playSound } from "./sound.js";
import type { NotifyEventKey, NotifySoundConfig } from "./types.js";

/** Friendly aliases for /notify-sound test arguments. */
export const EVENT_ALIASES: Record<string, NotifyEventKey> = {
	agent_settled: "agent_settled",
	done: "agent_settled",
	ask_user_prompt: "ask_user_prompt",
	question: "ask_user_prompt",
	permission_request: "permission_request",
	permission: "permission_request",
	tool_error: "tool_error",
	error: "tool_error",
	session_shutdown: "session_shutdown",
	exit: "session_shutdown",
};

/** What a /notify-sound test argument means. */
export type TestTarget =
	| { kind: "default" }
	| { kind: "event"; key: NotifyEventKey }
	| { kind: "path"; path: string };

/** Parse a /notify-sound test argument: alias → event, otherwise a path. */
export function parseTestTarget(target: string | undefined): TestTarget {
	if (!target) return { kind: "default" };
	const alias = EVENT_ALIASES[target];
	if (alias) return { kind: "event", key: alias };
	return { kind: "path", path: target };
}

/** Build the /notify-sound status lines. */
export function buildStatusLines(config: NotifySoundConfig): string[] {
	const lines = [
		"sound: " + (config.sound ? "on" : "off"),
		"cooldown: " + config.cooldown_ms + "ms",
		"suppressWhenFocused: " + (config.suppressWhenFocused ? "on" : "off"),
	];
	for (const key of ALL_EVENT_KEYS) {
		const p = resolveEventSound(config, key) || "(silent)";
		lines.push(key + ": " + p);
	}
	lines.push(
		"config: " + CONFIG_PATH + " (+ .pi/notify-sound.json per project)",
	);
	return lines;
}

export default function (pi: ExtensionAPI): void {
	// Register listeners once per extension load. Reload re-runs the factory;
	// wireEvents clears EventBus listeners first so nothing accumulates.
	wireEvents(pi);

	pi.on("session_start", (event, ctx) => {
		// First run: write a config template so the user knows where to look.
		ensureConfigFile();
		// Per-project config only applies to trusted projects.
		setSessionCwd(ctx.isProjectTrusted() ? ctx.cwd : undefined);
	});

	pi.on("session_shutdown", () => {
		unwireEvents();
	});

	// /notify-sound test [event|path]  — play a sound to verify.
	// /notify-sound (no args)          — show config status.
	pi.registerCommand("notify-sound", {
		description:
			"Play a test sound or show config (usage: /notify-sound [test [event|path]])",
		handler: async (args, ctx) => {
			const [sub, target] = args.trim().split(/\s+/, 2);
			const config = loadEffectiveConfig(
				ctx.isProjectTrusted() ? ctx.cwd : undefined,
			);

			if (sub === "test") {
				const parsed = parseTestTarget(target);
				if (parsed.kind === "event") {
					const path = resolveEventSound(config, parsed.key);
					if (!path) {
						ctx.ui.notify(
							"notify-sound: " + parsed.key + " is silent (disabled or muted)",
							"error",
						);
						return;
					}
					playSound(path);
					ctx.ui.notify("notify-sound: playing " + path, "info");
					return;
				}
				const path =
					parsed.kind === "default"
						? resolveEventSound(config, "agent_settled")
						: parsed.path;
				if (!path) {
					ctx.ui.notify("notify-sound: nothing to play (muted)", "error");
					return;
				}
				if (!existsSync(path)) {
					ctx.ui.notify("notify-sound: file not found: " + path, "error");
					return;
				}
				playSound(path);
				ctx.ui.notify("notify-sound: playing " + path, "info");
				return;
			}

			// Status.
			ctx.ui.notify(buildStatusLines(config).join(" | "), "info");
		},
	});
}
