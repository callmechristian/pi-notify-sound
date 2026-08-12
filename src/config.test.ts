import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	BUNDLED_SOUND_BY_EVENT,
	DEFAULT_CONFIG,
	ensureConfigFile,
	loadConfig,
	resolveEventSound,
} from "./config.js";
import type { NotifyEventKey, NotifySoundConfig } from "./types.js";

function tempConfig(contents?: string): string {
	const dir = mkdtempSync(join(tmpdir(), "pi-ns-test-"));
	const path = join(dir, "config.json");
	if (contents !== undefined) writeFileSync(path, contents);
	return path;
}

function cleanup(path: string): void {
	rmSync(join(path, ".."), { recursive: true, force: true });
}

function configWith(
	events: Partial<NotifySoundConfig["events"]>,
): NotifySoundConfig {
	return { ...DEFAULT_CONFIG, events: { ...DEFAULT_CONFIG.events, ...events } };
}

describe("loadConfig", () => {
	it("returns bundled defaults when the file is missing", () => {
		const p = tempConfig();
		try {
			const cfg = loadConfig(p);
			expect(cfg.sound).toBe(true);
			expect(cfg.events.agent_settled.sound).toBe("default");
			expect(cfg.events.ask_user_prompt.sound).toBe("default");
		} finally {
			cleanup(p);
		}
	});

	it("merges partial config over defaults", () => {
		const p = tempConfig(
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
			cleanup(p);
		}
	});

	it("falls back to defaults on invalid JSON", () => {
		const p = tempConfig("{ not json");
		try {
			expect(loadConfig(p).sound).toBe(true);
		} finally {
			cleanup(p);
		}
	});
});

describe("ensureConfigFile", () => {
	it('writes a template with "default" sounds and never overwrites an existing file', () => {
		const p = tempConfig();
		try {
			ensureConfigFile(p);
			const written = JSON.parse(readFileSync(p, "utf8")) as NotifySoundConfig;
			expect(written.sound).toBe(true);
			expect(written.events.agent_settled.sound).toBe("default");
			writeFileSync(p, JSON.stringify({ sound: false }));
			ensureConfigFile(p);
			expect(loadConfig(p).sound).toBe(false);
		} finally {
			cleanup(p);
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
		expect(resolveEventSound(DEFAULT_CONFIG, "permission_request")).toMatch(
			/dingding\.wav$/,
		);
		expect(resolveEventSound(DEFAULT_CONFIG, "tool_error")).toMatch(
			/studio-grand-notification\.wav$/,
		);
	});

	it("returns null for a disabled event (sound: null)", () => {
		const cfg = configWith({ ask_user_prompt: { sound: null } });
		expect(resolveEventSound(cfg, "ask_user_prompt")).toBeNull();
		expect(resolveEventSound(cfg, "agent_settled")).not.toBeNull();
	});

	it("returns null when the master toggle is off", () => {
		const cfg = { ...DEFAULT_CONFIG, sound: false };
		for (const key of Object.keys(DEFAULT_CONFIG.events) as NotifyEventKey[]) {
			expect(resolveEventSound(cfg, key)).toBeNull();
		}
	});

	it("plays a valid custom path and falls back to bundled for a missing one", () => {
		const existing = __filename; // a real file on disk
		const cfg = configWith({ agent_settled: { sound: existing } });
		expect(resolveEventSound(cfg, "agent_settled")).toBe(existing);
		const missing = configWith({
			agent_settled: { sound: "Z:\\definitely-missing.wav" },
		});
		expect(resolveEventSound(missing, "agent_settled")).toMatch(
			/dingding\.wav$/,
		);
	});

	it("keeps the bundled mapping in sync with the event keys", () => {
		for (const key of Object.keys(DEFAULT_CONFIG.events) as NotifyEventKey[]) {
			expect(BUNDLED_SOUND_BY_EVENT[key]).toMatch(/\.wav$/);
		}
	});
});
