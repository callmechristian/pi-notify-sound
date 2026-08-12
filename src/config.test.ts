import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	DEFAULT_CONFIG,
	ensureConfigFile,
	loadConfig,
	resolveSoundPath,
} from "./config.js";
import type { NotifySoundConfig } from "./types.js";

function tempConfig(contents?: string): string {
	const dir = mkdtempSync(join(tmpdir(), "pi-ns-test-"));
	const path = join(dir, "config.json");
	if (contents !== undefined) writeFileSync(path, contents);
	return path;
}

function cleanup(path: string): void {
	rmSync(join(path, ".."), { recursive: true, force: true });
}

function withSound(
	patch: Partial<NotifySoundConfig["sounds"]>,
): NotifySoundConfig {
	return { ...DEFAULT_CONFIG, sounds: { ...DEFAULT_CONFIG.sounds, ...patch } };
}

describe("loadConfig", () => {
	it("returns defaults when the file is missing", () => {
		const p = tempConfig();
		try {
			const cfg = loadConfig(p);
			expect(cfg.sound).toBe(true);
			expect(cfg.events.agent_settled.enabled).toBe(true);
			expect(cfg.sounds.complete).toBe(DEFAULT_CONFIG.sounds.complete);
			expect(cfg.sounds.complete).toMatch(/\.wav$/);
		} finally {
			cleanup(p);
		}
	});

	it("merges partial config over defaults", () => {
		const p = tempConfig(
			JSON.stringify({ sound: false, sounds: { complete: "C:\\x.wav" } }),
		);
		try {
			const cfg = loadConfig(p);
			expect(cfg.sound).toBe(false);
			expect(cfg.sounds.complete).toBe("C:\\x.wav");
			expect(cfg.sounds.question).toBe(DEFAULT_CONFIG.sounds.question);
			expect(cfg.events.ask_user_prompt.enabled).toBe(true);
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
	it("writes a template when missing and never overwrites an existing file", () => {
		const p = tempConfig();
		try {
			ensureConfigFile(p);
			const written = JSON.parse(readFileSync(p, "utf8")) as NotifySoundConfig;
			expect(written.sound).toBe(true);
			writeFileSync(p, JSON.stringify({ sound: false }));
			ensureConfigFile(p);
			expect(loadConfig(p).sound).toBe(false);
		} finally {
			cleanup(p);
		}
	});
});

describe("resolveSoundPath", () => {
	it("resolves a sound key and falls back to default for empty values", () => {
		const cfg = withSound({
			default: "d.wav",
			complete: "c.wav",
			question: "",
		});
		expect(resolveSoundPath(cfg, "complete")).toBe("c.wav");
		expect(resolveSoundPath(cfg, "question")).toBe("d.wav");
	});

	it("passes through absolute paths untouched", () => {
		expect(resolveSoundPath(DEFAULT_CONFIG, "E:\\a\\b.wav")).toBe(
			"E:\\a\\b.wav",
		);
	});

	it("returns the default sound when no key is given", () => {
		const cfg = withSound({ default: "d.wav" });
		expect(resolveSoundPath(cfg)).toBe("d.wav");
		expect(resolveSoundPath(cfg, undefined)).toBe("d.wav");
	});

	it("resolves bundled defaults for every sound key", () => {
		expect(resolveSoundPath(DEFAULT_CONFIG, "complete")).toMatch(/studio-grand-notification\.wav$/);
		expect(resolveSoundPath(DEFAULT_CONFIG, "question")).toMatch(/dingding\.wav$/);
		expect(resolveSoundPath(DEFAULT_CONFIG, "error")).toMatch(/\.wav$/);
		expect(resolveSoundPath(DEFAULT_CONFIG)).toMatch(/\.wav$/);
	});

	it("returns null when no sounds are configured", () => {
		const empty = {
			...DEFAULT_CONFIG,
			sounds: { default: "", complete: "", question: "", error: "" },
		};
		expect(resolveSoundPath(empty, "complete")).toBeNull();
		expect(resolveSoundPath(empty)).toBeNull();
	});
});