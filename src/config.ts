/**
 * pi-notify-sound — config loading.
 *
 * Config is OPTIONAL and lives at ~/.pi/notify-sound/config.json. Without it
 * (or with any missing keys), the bundled sounds in src/sounds/ apply. Events
 * read config at fire-time so edits apply without a reload.
 *
 * Per-event `sound` semantics:
 *   "default" → the bundled default sound for that event
 *   null      → disabled (silent)
 *   <path>    → a valid wav path; missing files fall back to the bundled default
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NotifyEventKey, NotifySoundConfig } from "./types.js";

export const CONFIG_DIR = join(homedir(), ".pi", "notify-sound");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

/** Directory of bundled sounds, resolved relative to this module (works from a clone, junction, or pi-installed package). */
export const BUNDLED_SOUNDS_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	"sounds",
);

/** Bundled sound file per event — the value behind `sound: "default"`.
 * dingding for everything; the grand-piano sample is reserved for errors. */
export const BUNDLED_SOUND_BY_EVENT: Record<NotifyEventKey, string> = {
	agent_settled: "723291__glitched7777__dingding.wav",
	ask_user_prompt: "723291__glitched7777__dingding.wav",
	permission_request: "723291__glitched7777__dingding.wav",
	tool_error: "818998__allesyt__studio-grand-notification.wav",
};

/** Absolute path of a bundled sound file. */
export function bundledSoundPath(file: string): string {
	return join(BUNDLED_SOUNDS_DIR, file);
}

/** Defaults — every event uses its bundled sound; no config file needed. */
export const DEFAULT_CONFIG: NotifySoundConfig = {
	sound: true,
	events: {
		agent_settled: { sound: "default" },
		ask_user_prompt: { sound: "default" },
		permission_request: { sound: "default" },
		tool_error: { sound: "default" },
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

/**
 * Resolve the sound to play for an event, or null when silent:
 * - master toggle off          → null
 * - event sound null/undefined → null (disabled)
 * - event sound "default"      → the event's bundled sound
 * - event sound path (exists)  → that path
 * - event sound path (missing) → the event's bundled sound (graceful degradation)
 */
export function resolveEventSound(
	config: NotifySoundConfig,
	eventKey: NotifyEventKey,
): string | null {
	if (!config.sound) return null;
	const sound = config.events[eventKey]?.sound;
	if (sound === null || sound === undefined) return null;
	if (sound === "default") {
		return bundledSoundPath(BUNDLED_SOUND_BY_EVENT[eventKey]);
	}
	return existsSync(sound)
		? sound
		: bundledSoundPath(BUNDLED_SOUND_BY_EVENT[eventKey]);
}

function mergeWithDefaults(
	loaded: Partial<NotifySoundConfig>,
): NotifySoundConfig {
	return {
		sound: loaded.sound ?? DEFAULT_CONFIG.sound,
		events: { ...DEFAULT_CONFIG.events, ...loaded.events },
	};
}

function cloneDefaults(): NotifySoundConfig {
	return {
		...DEFAULT_CONFIG,
		events: { ...DEFAULT_CONFIG.events },
	};
}