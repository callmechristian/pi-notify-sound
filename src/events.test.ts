import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotifyEventKey, NotifySoundConfig } from "./types.js";

const fixedConfig: NotifySoundConfig = {
	sound: true,
	cooldown_ms: 0,
	suppressWhenFocused: false,
	events: {
		agent_settled: { sound: "default" },
		ask_user_prompt: { sound: "default" },
		permission_request: { sound: null },
		tool_error: { sound: null },
		breaking_error: { sound: "default" },
		session_shutdown: { sound: null },
	},
};

vi.mock("./config.js", () => ({
	loadEffectiveConfig: () => fixedConfig,
	resolveEventSound: (cfg: NotifySoundConfig, eventKey: NotifyEventKey) => {
		if (!cfg.sound) return null;
		const sound = cfg.events[eventKey]?.sound;
		if (sound === null || sound === undefined) return null;
		if (sound === "default") return "bundled-" + eventKey + ".wav";
		return sound;
	},
}));

const { playSound } = vi.hoisted(() => ({ playSound: vi.fn() }));
vi.mock("./sound.js", () => ({ playSound }));

const { isWindowFocused } = vi.hoisted(() => ({
	isWindowFocused: vi.fn(async () => false),
}));
vi.mock("./focus.js", () => ({ isWindowFocused }));

import { resetPlaybackState, unwireEvents, wireEvents } from "./events.js";

type MockPi = {
	on: ReturnType<typeof vi.fn>;
	events: { on: ReturnType<typeof vi.fn> };
	subs: Array<ReturnType<typeof vi.fn>>;
};

function makePi(): MockPi {
	const subs: Array<ReturnType<typeof vi.fn>> = [];
	return {
		on: vi.fn(),
		events: {
			on: vi.fn(() => {
				const unsub = vi.fn();
				subs.push(unsub);
				return unsub;
			}),
		},
		subs,
	};
}

function wire(pi: MockPi): void {
	wireEvents(pi as unknown as ExtensionAPI);
}

function unwire(): void {
	unwireEvents();
}

function handlerFor(
	pi: MockPi,
	channel: string,
): (...args: unknown[]) => Promise<void> {
	const call = pi.on.mock.calls.find((c: string[]) => c[0] === channel);
	const call2 =
		call ?? pi.events.on.mock.calls.find((c: string[]) => c[0] === channel);
	if (!call2) throw new Error("no handler for " + channel);
	return call2[1];
}

beforeEach(() => {
	playSound.mockClear();
	isWindowFocused.mockClear();
	resetPlaybackState();
});

afterEach(() => {
	vi.useRealTimers();
	fixedConfig.sound = true;
	fixedConfig.cooldown_ms = 0;
	fixedConfig.suppressWhenFocused = false;
	fixedConfig.events.session_shutdown = { sound: null };
	fixedConfig.events.tool_error = { sound: null };
});

describe("wireEvents", () => {
	it("registers lifecycle and prompt listeners", () => {
		const pi = makePi();
		wire(pi);
		expect(pi.on).toHaveBeenCalledWith("agent_settled", expect.any(Function));
		expect(pi.on).toHaveBeenCalledWith(
			"tool_execution_end",
			expect.any(Function),
		);
		expect(pi.on).toHaveBeenCalledWith(
			"session_shutdown",
			expect.any(Function),
		);
		expect(pi.events.on).toHaveBeenCalledWith(
			"rpiv:ask-user:prompt",
			expect.any(Function),
		);
		expect(pi.events.on).toHaveBeenCalledWith(
			"permissions:ui_prompt",
			expect.any(Function),
		);
	});

	it("plays the bundled default sound on agent_settled", async () => {
		const pi = makePi();
		wire(pi);
		await handlerFor(pi, "agent_settled")();
		expect(playSound).toHaveBeenCalledWith("bundled-agent_settled.wav");
	});

	it("plays the bundled default sound on ask-user prompt", async () => {
		const pi = makePi();
		wire(pi);
		await handlerFor(pi, "rpiv:ask-user:prompt")({});
		expect(playSound).toHaveBeenCalledWith("bundled-ask_user_prompt.wav");
	});

	it("plays the grand-piano sound when a tool call fails (explicit flag)", async () => {
		fixedConfig.events.tool_error = { sound: "default" };
		const pi = makePi();
		wire(pi);
		await handlerFor(pi, "tool_execution_end")({ isError: true });
		expect(playSound).toHaveBeenCalledWith("bundled-tool_error.wav");
	});

	it("does not play for tool errors by default (explicit flag required)", async () => {
		const pi = makePi();
		wire(pi);
		await handlerFor(pi, "tool_execution_end")({ isError: true });
		expect(playSound).not.toHaveBeenCalled();
	});

	it("stays silent when a tool call succeeds", async () => {
		const pi = makePi();
		wire(pi);
		await handlerFor(pi, "tool_execution_end")({ isError: false });
		expect(playSound).not.toHaveBeenCalled();
	});

	it("does not play for a disabled event (sound: null)", async () => {
		const pi = makePi();
		wire(pi);
		await handlerFor(pi, "permissions:ui_prompt")({});
		expect(playSound).not.toHaveBeenCalled();
	});

	it("stays silent for session_shutdown by default (opt-in)", async () => {
		const pi = makePi();
		wire(pi);
		await handlerFor(pi, "session_shutdown")({});
		expect(playSound).not.toHaveBeenCalled();
	});

	it("plays for session_shutdown once enabled", async () => {
		fixedConfig.events.session_shutdown = { sound: "default" };
		const pi = makePi();
		wire(pi);
		await handlerFor(pi, "session_shutdown")({});
		expect(playSound).toHaveBeenCalledWith("bundled-session_shutdown.wav");
	});

	it("silences everything when the master toggle is off", async () => {
		fixedConfig.sound = false;
		const pi = makePi();
		wire(pi);
		await handlerFor(pi, "agent_settled")();
		expect(playSound).not.toHaveBeenCalled();
	});

	it("plays the breaking sound when the run ends with a provider error", async () => {
		const pi = makePi();
		wire(pi);
		await handlerFor(pi, "agent_end")({
			messages: [
				{ role: "user", content: "x" },
				{ role: "assistant", stopReason: "error" },
			],
		});
		expect(playSound).toHaveBeenCalledWith("bundled-breaking_error.wav");
	});

	it("plays the breaking sound when the run is aborted", async () => {
		const pi = makePi();
		wire(pi);
		await handlerFor(pi, "agent_end")({
			messages: [{ role: "assistant", stopReason: "aborted" }],
		});
		expect(playSound).toHaveBeenCalledWith("bundled-breaking_error.wav");
	});

	it("stays silent on normal completions (stop/tool_use/length)", async () => {
		const pi = makePi();
		wire(pi);
		for (const stopReason of ["stop", "tool_use", "length", undefined]) {
			playSound.mockClear();
			await handlerFor(pi, "agent_end")({
				messages: [{ role: "assistant", stopReason }],
			});
			expect(playSound).not.toHaveBeenCalled();
		}
	});

	it("dedupes within cooldown_ms and plays again after", async () => {
		fixedConfig.events.tool_error = { sound: "default" };
		vi.useFakeTimers();
		vi.setSystemTime(1_000_000);
		fixedConfig.cooldown_ms = 10_000;
		const pi = makePi();
		wire(pi);
		await handlerFor(pi, "agent_settled")();
		expect(playSound).toHaveBeenCalledTimes(1);

		playSound.mockClear();
		vi.setSystemTime(1_000_005); // 5ms later — within cooldown
		await handlerFor(pi, "tool_execution_end")({ isError: true });
		expect(playSound).not.toHaveBeenCalled();

		vi.setSystemTime(1_010_001); // past the cooldown
		await handlerFor(pi, "tool_execution_end")({ isError: true });
		expect(playSound).toHaveBeenCalledWith("bundled-tool_error.wav");
	});

	it("suppresses playback when the terminal is focused", async () => {
		fixedConfig.suppressWhenFocused = true;
		isWindowFocused.mockResolvedValue(true);
		const pi = makePi();
		wire(pi);
		await handlerFor(pi, "agent_settled")();
		expect(isWindowFocused).toHaveBeenCalled();
		expect(playSound).not.toHaveBeenCalled();
	});

	it("plays when not focused", async () => {
		fixedConfig.suppressWhenFocused = true;
		isWindowFocused.mockResolvedValue(false);
		const pi = makePi();
		wire(pi);
		await handlerFor(pi, "agent_settled")();
		expect(playSound).toHaveBeenCalledWith("bundled-agent_settled.wav");
	});

	it("unsubscribes previous EventBus listeners on re-registration", () => {
		const pi = makePi();
		wire(pi);
		const firstBatch = pi.subs.slice();
		expect(firstBatch.every((s) => s.mock.calls.length === 0)).toBe(true);
		wire(pi);
		const secondBatch = pi.subs.slice(firstBatch.length);
		expect(firstBatch.every((s) => s.mock.calls.length === 1)).toBe(true);
		expect(secondBatch.every((s) => s.mock.calls.length === 0)).toBe(true);
	});

	it("unwireEvents unsubscribes EventBus listeners", () => {
		const pi = makePi();
		wire(pi);
		unwire();
		expect(pi.subs.every((s) => s.mock.calls.length === 1)).toBe(true);
	});
});