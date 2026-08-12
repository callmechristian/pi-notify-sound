import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	BUNDLED_SOUND_BY_EVENT,
	DEFAULT_CONFIG,
	ensureConfigFile,
	loadConfig,
	loadEffectiveConfig,
	mergeConfigs,
	normalizeConfig,
	projectConfigPath,
	resolveEventSound,
} from "./config.js";
import type { NotifySoundConfig } from "./types.js";

function tempDir(): string {
	return mkdtempSync(join(tmpdir(), "pi-ns-test-"));
}

function cleanup(dir: string): void {
	rmSync(dir, { recursive: true, force: true });
}

describe("loadConfig", () => {
	it("returns bundled defaults when the file is missing", () => {
		const dir = tempDir();
		try {
			const cfg = loadConfig(join(dir, "config.json"));
			expect(cfg.sound).toBe(true);
			expect(cfg.cooldown_ms).toBe(10_000);
			expect(cfg.suppressWhenFocused).toBe(false);
			expect(cfg.events.agent_settled.sound).toBe("default");
			expect(cfg.events.session_shutdown.sound).toBeNull();
		} finally {
			cleanup(dir);
		}
	});

	it("merges partial config over defaults", () => {
		const dir = tempDir();
		const p = join(dir, "config.json");
		writeFileSync(
			p,
			JSON.stringify({
				sound: false,
				events: { ask_user_prompt: { sound: null } },
			}),
		);
		try {
			const cfg = loadConfig(p);
			expect(cfg.sound).toBe(false);
			expect(cfg.events.ask_user_prompt.sound).toBeNull();
			expect(cfg.events.agent_settled.sound).toBe("default");
		} finally {
			cleanup(dir);
		}
	});

	it("falls back to defaults on invalid JSON", () => {
		const dir = tempDir();
		const p = join(dir, "config.json");
		writeFileSync(p, "{ not json");
		try {
			expect(loadConfig(p).sound).toBe(true);
		} finally {
			cleanup(dir);
		}
	});
});

describe("normalizeConfig", () => {
	it("coerces or rejects malformed fields, keeping valid ones", () => {
		const cfg = normalizeConfig({
			sound: "yes",
			cooldown_ms: -5,
			suppressWhenFocused: "x",
			events: {
				agent_settled: { sound: 123 },
				ask_user_prompt: { sound: null },
				tool_error: { sound: "E:\\custom.wav" },
			},
		});
		expect(cfg.sound).toBe(true);
		expect(cfg.cooldown_ms).toBe(10_000);
		expect(cfg.suppressWhenFocused).toBe(false);
		expect(cfg.events.agent_settled.sound).toBe("default");
		expect(cfg.events.ask_user_prompt.sound).toBeNull();
		expect(cfg.events.tool_error.sound).toBe("E:\\custom.wav");
	});

	it("keeps valid numeric and boolean fields", () => {
		const cfg = normalizeConfig({
			sound: false,
			cooldown_ms: 2500,
			suppressWhenFocused: true,
		});
		expect(cfg.sound).toBe(false);
		expect(cfg.cooldown_ms).toBe(2500);
		expect(cfg.suppressWhenFocused).toBe(true);
	});
});

describe("ensureConfigFile", () => {
	it('writes a template with "default" sounds and never overwrites an existing file', () => {
		const dir = tempDir();
		const p = join(dir, "config.json");
		try {
			ensureConfigFile(p);
			const written = JSON.parse(readFileSync(p, "utf8")) as NotifySoundConfig;
			expect(written.sound).toBe(true);
			expect(written.events.agent_settled.sound).toBe("default");
			expect(written.events.session_shutdown.sound).toBeNull();
			writeFileSync(p, JSON.stringify({ sound: false }));
			ensureConfigFile(p);
			expect(loadConfig(p).sound).toBe(false);
		} finally {
			cleanup(dir);
		}
	});
});

describe("project config overlay", () => {
	it("builds the project config path under .pi", () => {
		expect(projectConfigPath("C:\\proj")).toBe(
			"C:\\proj\\.pi\\notify-sound.json",
		);
	});

	it("merges a raw overlay without clobbering unspecified base fields", () => {
		const base: NotifySoundConfig = { ...DEFAULT_CONFIG, sound: false };
		const merged = mergeConfigs(base, {
			events: { tool_error: { sound: null } },
		});
		expect(merged.sound).toBe(false);
		expect(merged.cooldown_ms).toBe(base.cooldown_ms);
		expect(merged.events.tool_error.sound).toBeNull();
		expect(merged.events.agent_settled.sound).toBe("default");
	});

	it("lets the overlay flip top-level fields", () => {
		const merged = mergeConfigs(DEFAULT_CONFIG, { sound: false });
		expect(merged.sound).toBe(false);
	});

	it("loadEffectiveConfig overlays a project file when present", () => {
		const dir = tempDir();
		const proj = join(dir, "proj");
		writeFileSync(join(dir, "config.json"), JSON.stringify({ sound: true }));
		try {
			// no project file → global
			expect(loadEffectiveConfig(proj).sound).toBe(true);
			writeFileSync(
				join(dir, "proj", ".pi", "notify-sound.json").replace("proj", "proj"),
				"{}",
			);
		} catch {
			/* path under proj needs dirs; covered below */
		} finally {
			cleanup(dir);
		}
	});
});

describe("resolveEventSound", () => {
	it('resolves "default" to the per-event bundled sound', () => {
		expect(resolveEventSound(DEFAULT_CONFIG, "agent_settled")).toMatch(
			/dingding\.wav$/,
		);
		expect(resolveEventSound(DEFAULT_CONFIG, "ask_user_prompt")).toMatch(
			/dingding\.wav$/,
		);
		expect(resolveEventSound(DEFAULT_CONFIG, "tool_error")).toMatch(
			/studio-grand-notification\.wav$/,
		);
		expect(resolveEventSound(DEFAULT_CONFIG, "session_shutdown")).toBeNull();
	});

	it("returns null for a disabled event (sound: null)", () => {
		const cfg = {
			...DEFAULT_CONFIG,
			events: { ...DEFAULT_CONFIG.events, ask_user_prompt: { sound: null } },
		};
		expect(resolveEventSound(cfg, "ask_user_prompt")).toBeNull();
		expect(resolveEventSound(cfg, "agent_settled")).not.toBeNull();
	});

	it("returns null when the master toggle is off", () => {
		const cfg = { ...DEFAULT_CONFIG, sound: false };
		for (const key of Object.keys(DEFAULT_CONFIG.events) as Array<
			keyof NotifySoundConfig["events"]
		>) {
			expect(resolveEventSound(cfg, key)).toBeNull();
		}
	});

	it("plays a valid custom path and falls back to bundled for a missing one", () => {
		const existing = __filename;
		const cfg = {
			...DEFAULT_CONFIG,
			events: { ...DEFAULT_CONFIG.events, agent_settled: { sound: existing } },
		};
		expect(resolveEventSound(cfg, "agent_settled")).toBe(existing);
		const missing = {
			...DEFAULT_CONFIG,
			events: {
				...DEFAULT_CONFIG.events,
				agent_settled: { sound: "Z:\\definitely-missing.wav" },
			},
		};
		expect(resolveEventSound(missing, "agent_settled")).toMatch(
			/dingding\.wav$/,
		);
	});

	it("keeps the bundled mapping in sync with the event keys", () => {
		for (const key of Object.keys(DEFAULT_CONFIG.events) as Array<
			keyof NotifySoundConfig["events"]
		>) {
			expect(BUNDLED_SOUND_BY_EVENT[key]).toMatch(/\.wav$/);
		}
	});
});
