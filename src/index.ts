/**
 * pi-notify-sound — a pi extension that plays a sound when the agent finishes
 * and when it waits for your input (questions, permission prompts).
 *
 * Config: ~/.pi/notify-sound/config.json (OPTIONAL — see README for schema)
 *   per-event sound: "default" (bundled) | null (disabled) | <wav path>
 * Test:   /notify-sound test [event|path]
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	CONFIG_PATH,
	ensureConfigFile,
	loadConfig,
	resolveEventSound,
} from "./config.js";
import { unwireEvents, wireEvents } from "./events.js";
import { playSound } from "./sound.js";
import type { NotifyEventKey } from "./types.js";

const EVENT_KEYS: ReadonlyArray<NotifyEventKey> = [
	"agent_settled",
	"ask_user_prompt",
	"permission_request",
];

/** Friendly aliases for /notify-sound test arguments. */
const EVENT_ALIASES: Record<string, NotifyEventKey> = {
	agent_settled: "agent_settled",
	done: "agent_settled",
	ask_user_prompt: "ask_user_prompt",
	question: "ask_user_prompt",
	permission_request: "permission_request",
	permission: "permission_request",
};

export default function (pi: ExtensionAPI): void {
	// Register listeners once per extension load. Reload re-runs the factory;
	// wireEvents clears EventBus listeners first so nothing accumulates.
	wireEvents(pi);

	pi.on("session_start", () => {
		// First run: write a config template so the user knows where to look.
		ensureConfigFile();
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
			const config = loadConfig();

			if (sub === "test") {
				const eventKey = target ? EVENT_ALIASES[target] : "agent_settled";
				if (eventKey) {
					const path = resolveEventSound(config, eventKey);
					if (!path) {
						ctx.ui.notify(
							"notify-sound: " + eventKey + " is silent (disabled or muted)",
							"error",
						);
						return;
					}
					playSound(path);
					ctx.ui.notify("notify-sound: playing " + path, "info");
					return;
				}
				// Not an event alias — treat the argument as a direct wav path.
				playSound(target);
				ctx.ui.notify("notify-sound: playing " + target, "info");
				return;
			}

			// Status: show what each event resolves to.
			const lines = ["sound: " + (config.sound ? "on" : "off")];
			for (const key of EVENT_KEYS) {
				const p = resolveEventSound(config, key) || "(silent)";
				lines.push(key + ": " + p);
			}
			lines.push("config: " + CONFIG_PATH + " (optional)");
			ctx.ui.notify(lines.join(" | "), "info");
		},
	});
}
