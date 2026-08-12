/**
 * pi-notify-sound — config loading.
 *
 * Config lives at ~/.pi/notify-sound/config.json (per-machine, not committed).
 * Missing or invalid config falls back to defaults; events read config at
 * fire-time so edits apply without a reload.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NotifySoundConfig, NotifyEventKey, SoundKey } from "./types.js";

export const CONFIG_DIR = join(homedir(), ".pi", "notify-sound");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

/** Directory of bundled sounds, resolved relative to this module (works from the repo, a junction, or a pi-installed package). */
export const BUNDLED_SOUNDS_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	"sounds",
);

/** Absolute path of a bundled sound file. */
export function bundledSoundPath(file: string): string {
	return join(BUNDLED_SOUNDS_DIR, file);
}

/**
 * Defaults — bundled notification sounds (no machine-specific paths).
 * Users override via ~/.pi/notify-sound/config.json.
 */
export const DEFAULT_CONFIG: NotifySoundConfig = {
	sound: true,
	sounds: {
		default: bundledSoundPath("818998__allesyt__studio-grand-notification.wav"),
		complete: bundledSoundPath("818998__allesyt__studio-grand-notification.wav"),
		question: bundledSoundPath("723291__glitched7777__dingding.wav"),
		error: bundledSoundPath("818998__allesyt__studio-grand-notification.wav"),
	},
	events: {
		agent_settled: { enabled: true, sound: "complete" },
		ask_user_prompt: { enabled: true, sound: "question" },
		permission_request: { enabled: true, sound: "question" },
	},
};

/** Load config from disk, merged over defaults. Never throws. */
export function loadConfig(path: string = CONFIG_PATH): NotifySoundConfig {
	try {
		if (existsSync(path)) {
			const raw = JSON.parse(
				readFileSync(path, "utf8"),
			) as Partial<NotifySoundConfig>;
			return mergeWithDefaults(raw);
		}
	} catch {
		// Config load failure — fall back to defaults.
	}
	return cloneDefaults();
}

/** Write a config template (only if none exists) so the user knows where to look. */
export function ensureConfigFile(path: string = CONFIG_PATH): void {
	if (existsSync(path)) return;
	try {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(
			path,
			JSON.stringify(cloneDefaults(), null, 2) + "\n",
			"utf8",
		);
	} catch {
		// Non-fatal.
	}
}

/** Resolve an event's sound to an absolute path, or null when nothing should play. */
export function resolveSoundPath(
	config: NotifySoundConfig,
	sound?: SoundKey | string,
): string | null {
	if (sound && sound in config.sounds) {
		return config.sounds[sound as SoundKey] || config.sounds.default || null;
	}
	if (sound) return sound; // absolute path
	return config.sounds.default || null;
}

function mergeWithDefaults(
	loaded: Partial<NotifySoundConfig>,
): NotifySoundConfig {
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
