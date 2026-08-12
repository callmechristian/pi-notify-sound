import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config.js";
import { buildStatusLines, parseTestTarget } from "./index.js";

describe("parseTestTarget", () => {
	it("defaults to the agent-done event with no argument", () => {
		expect(parseTestTarget(undefined)).toEqual({ kind: "default" });
		expect(parseTestTarget("")).toEqual({ kind: "default" });
	});

	it("maps friendly aliases to events", () => {
		expect(parseTestTarget("question")).toEqual({
			kind: "event",
			key: "ask_user_prompt",
		});
		expect(parseTestTarget("done")).toEqual({
			kind: "event",
			key: "agent_settled",
		});
		expect(parseTestTarget("error")).toEqual({
			kind: "event",
			key: "tool_error",
		});
		expect(parseTestTarget("exit")).toEqual({
			kind: "event",
			key: "session_shutdown",
		});
		expect(parseTestTarget("interrupt")).toEqual({
			kind: "event",
			key: "breaking_error",
		});
	});

	it("treats anything else as a path", () => {
		expect(parseTestTarget("E:\\a\\b.wav")).toEqual({
			kind: "path",
			path: "E:\\a\\b.wav",
		});
		expect(parseTestTarget("note.wav")).toEqual({
			kind: "path",
			path: "note.wav",
		});
	});
});

describe("buildStatusLines", () => {
	it("reports toggles, per-event resolution, and the config location", () => {
		const lines = buildStatusLines(DEFAULT_CONFIG);
		expect(lines[0]).toBe("sound: on");
		expect(lines[1]).toBe("cooldown: 10000ms");
		expect(lines[2]).toBe("suppressWhenFocused: off");
		expect(lines.some((l) => l.startsWith("agent_settled:"))).toBe(true);
		expect(lines.some((l) => l.endsWith("(silent)"))).toBe(true);
		expect(lines.some((l) => l.includes(".pi/notify-sound.json"))).toBe(true);
	});
});
