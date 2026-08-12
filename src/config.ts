/**
 * pi-notify-sound — config loading.
 *
 * Config lives at ~/.pi/notify-sound/config.json (per-machine, not committed).
 * Missing or invalid config falls back to defaults; events read config at
 * fire-time so edits apply without a reload.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { NotifySoundConfig, NotifyEventKey, SoundKey } from "./types.js";

export const CONFIG_DIR = join(homedir(), ".pi", "notify-sound");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

/** Defaults — no machine-specific paths; events enabled but silent until configured. */
export const DEFAULT_CONFIG: NotifySoundConfig = {
  sound: true,
  sounds: { default: "", complete: "", question: "", error: "" },
  events: {
    agent_settled: { enabled: true, sound: "complete" },
    ask_user_prompt: { enabled: true, sound: "question" },
    permission_request: { enabled: true, sound: "question" },
  },
};

/** Load config from disk, merged over defaults. Never throws. */
export function loadConfig(): NotifySoundConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<NotifySoundConfig>;
      return mergeWithDefaults(raw);
    }
  } catch {
    // Config load failure — fall back to defaults.
  }
  return cloneDefaults();
}

/** Write a config template (only if none exists) so the user knows where to look. */
export function ensureConfigFile(): void {
  if (existsSync(CONFIG_PATH)) return;
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(cloneDefaults(), null, 2) + "\n", "utf8");
  } catch {
    // Non-fatal.
  }
}

/** Resolve an event's sound to an absolute path, or null when nothing should play. */
export function resolveSoundPath(
  config: NotifySoundConfig,
  sound?: SoundKey | string
): string | null {
  if (sound && sound in config.sounds) {
    return config.sounds[sound as SoundKey] || config.sounds.default || null;
  }
  if (sound) return sound; // absolute path
  return config.sounds.default || null;
}

function mergeWithDefaults(loaded: Partial<NotifySoundConfig>): NotifySoundConfig {
  return {
    sound: loaded.sound ?? DEFAULT_CONFIG.sound,
    sounds: { ...DEFAULT_CONFIG.sounds, ...loaded.sounds },
    events: { ...DEFAULT_CONFIG.events, ...loaded.events },
  };
}

function cloneDefaults(): NotifySoundConfig {
  return {
    ...DEFAULT_CONFIG,
    sounds: { ...DEFAULT_CONFIG.sounds },
    events: { ...DEFAULT_CONFIG.events },
  };
}
