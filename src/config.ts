/**
 * pi-notify-sound — config loading.
 *
 * Config is OPTIONAL and lives at ~/.pi/notify-sound/config.json, with an
 * optional per-project overlay at <cwd>/.pi/notify-sound.json. Without any
 * config the bundled sounds in src/sounds/ apply. Events read config at
 * fire-time so edits apply without a reload.
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
import type {
	EventSoundConfig,
	NotifyEventKey,
	NotifySoundConfig,
} from "./types.js";

export const CONFIG_DIR = join(homedir(), ".pi", "notify-sound");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");
export const PROJECT_CONFIG_FILE = "notify-sound.json";

export const ALL_EVENT_KEYS: ReadonlyArray<NotifyEventKey> = [
	"agent_settled",
	"ask_user_prompt",
	"permission_request",
	"tool_error",
	"session_shutdown",
];

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
	session_shutdown: "723291__glitched7777__dingding.wav",
};

/** Absolute path of a bundled sound file. */
export function bundledSoundPath(file: string): string {
	return join(BUNDLED_SOUNDS_DIR, file);
}

/** Defaults — every event uses its bundled sound; no config file needed.
 * `session_shutdown` is opt-in (null = silent). */
export const DEFAULT_CONFIG: NotifySoundConfig = {
	sound: true,
	cooldown_ms: 10_000,
	suppressWhenFocused: false,
	events: {
		agent_settled: { sound: "default" },
		ask_user_prompt: { sound: "default" },
		permission_request: { sound: "default" },
		tool_error: { sound: "default" },
		session_shutdown: { sound: null },
	},
};

/** Path of the per-project config file for a project dir. */
export function projectConfigPath(cwd: string): string {
	return join(cwd, ".pi", PROJECT_CONFIG_FILE);
}

/**
 * Normalize an unknown raw config into a valid NotifySoundConfig.
 * Missing or malformed fields fall back to `fallback` (defaults by default).
 */
export function normalizeConfig(
	raw: unknown,
	fallback: NotifySoundConfig = DEFAULT_CONFIG,
): NotifySoundConfig {
	const r = (raw ?? {}) as Record<string, unknown>;
	const rawEvents =
		typeof r.events === "object" && r.events !== null
			? (r.events as Record<string, unknown>)
			: {};
	const events = {} as Record<NotifyEventKey, EventSoundConfig>;
	for (const key of ALL_EVENT_KEYS) {
		const ev = rawEvents[key];
		const sound =
			typeof ev === "object" && ev !== null
				? (ev as { sound?: unknown }).sound
				: undefined;
		const valid = sound === null || typeof sound === "string";
		events[key] = { sound: valid ? sound : fallback.events[key].sound };
	}
	return {
		sound: typeof r.sound === "boolean" ? r.sound : fallback.sound,
		cooldown_ms:
			typeof r.cooldown_ms === "number" &&
			Number.isFinite(r.cooldown_ms) &&
			r.cooldown_ms >= 0
				? r.cooldown_ms
				: fallback.cooldown_ms,
		suppressWhenFocused:
			typeof r.suppressWhenFocused === "boolean"
				? r.suppressWhenFocused
				: fallback.suppressWhenFocused,
		events,
	};
}

/** Load the global config from disk, normalized. Never throws. */
export function loadConfig(path: string = CONFIG_PATH): NotifySoundConfig {
	try {
		if (existsSync(path)) {
			const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
			return normalizeConfig(raw);
		}
	} catch {
		// Config load failure — fall back to defaults.
	}
	return cloneDefaults();
}

/** Raw per-project config overlay (parsed JSON), or null when absent/invalid. */
export function loadProjectConfigRaw(cwd: string): unknown {
	const path = projectConfigPath(cwd);
	try {
		if (existsSync(path)) {
			return JSON.parse(readFileSync(path, "utf8"));
		}
	} catch {
		// Project config load failure — no overlay.
	}
	return null;
}

/**
 * Merge a raw overlay over a base config. Only fields present (and valid) in
 * the overlay override the base; per-event sound values merge per key.
 */
export function mergeConfigs(
	base: NotifySoundConfig,
	rawOverlay: unknown,
): NotifySoundConfig {
	const o = (rawOverlay ?? {}) as Record<string, unknown>;
	const rawEvents =
		typeof o.events === "object" && o.events !== null
			? (o.events as Record<string, unknown>)
			: {};
	const events = {} as Record<NotifyEventKey, EventSoundConfig>;
	for (const key of ALL_EVENT_KEYS) {
		const ev = rawEvents[key];
		const sound =
			typeof ev === "object" && ev !== null
				? (ev as { sound?: unknown }).sound
				: undefined;
		const valid = sound === null || typeof sound === "string";
		events[key] = { sound: valid ? sound : base.events[key].sound };
	}
	return normalizeConfig(
		{
			...("sound" in o && { sound: o.sound }),
			...("cooldown_ms" in o && { cooldown_ms: o.cooldown_ms }),
			...("suppressWhenFocused" in o && {
				suppressWhenFocused: o.suppressWhenFocused,
			}),
			events,
		},
		base,
	);
}

/** Effective config: global, optionally overlaid with the project config. */
export function loadEffectiveConfig(cwd?: string): NotifySoundConfig {
	const global = loadConfig();
	if (!cwd) return global;
	const project = loadProjectConfigRaw(cwd);
	return project ? mergeConfigs(global, project) : global;
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

function cloneDefaults(): NotifySoundConfig {
	return normalizeConfig(DEFAULT_CONFIG);
}
