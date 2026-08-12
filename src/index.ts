/**
 * pi-notify-sound — a pi extension that plays a sound when the agent finishes
 * and when it waits for your input (questions, permission prompts).
 *
 * Config: ~/.pi/notify-sound/config.json  (see README for schema)
 * Test:   /notify-sound test [key|path]
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CONFIG_PATH, ensureConfigFile, loadConfig, resolveSoundPath } from "./config.js";
import { wireEvents, unwireEvents } from "./events.js";
import { playSound } from "./sound.js";
import type { SoundKey } from "./types.js";

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

  // /notify-sound test [key|path]  — play a sound to verify.
  // /notify-sound (no args)        — show config status.
  pi.registerCommand("notify-sound", {
    description: "Play a test sound or show config (usage: /notify-sound [test [key|path]])",
    handler: async (args, ctx) => {
      const [sub, target] = args.trim().split(/\s+/, 2);
      const config = loadConfig();

      if (sub === "test") {
        const path = target
          ? resolveSoundPath(config, target as SoundKey)
          : config.sounds.default || config.sounds.complete || null;
        if (!path) {
          ctx.ui.notify("notify-sound: no sound configured for that key", "error");
          return;
        }
        playSound(path);
        ctx.ui.notify("notify-sound: playing " + path, "info");
        return;
      }

      // Status.
      const lines = ["sound: " + (config.sound ? "on" : "off")];
      for (const [key, ev] of Object.entries(config.events)) {
        const p = resolveSoundPath(config, ev.sound) || "(none)";
        lines.push(key + ": " + (ev.enabled ? "on" : "off") + " -> " + p);
      }
      lines.push("config: " + CONFIG_PATH);
      ctx.ui.notify(lines.join(" | "), "info");
    },
  });
}
