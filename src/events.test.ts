import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotifySoundConfig } from "./types.js";

const fixedConfig: NotifySoundConfig = {
	sound: true,
	sounds: {
		default: "d.wav",
		complete: "c.wav",
		question: "q.wav",
		error: "e.wav",
	},
	events: {
		agent_settled: { enabled: true, sound: "complete" },
		ask_user_prompt: { enabled: true, sound: "question" },
		permission_request: { enabled: false, sound: "question" },
	},
};

vi.mock("./config.js", () => ({
	loadConfig: () => fixedConfig,
	resolveSoundPath: (cfg: NotifySoundConfig, sound?: string) => {
		if (sound && sound in cfg.sounds)
			return (
				cfg.sounds[sound as keyof NotifySoundConfig["sounds"]] ||
				cfg.sounds.default ||
				null
			);
		if (sound) return sound;
		return cfg.sounds.default || null;
	},
}));

const { playSound } = vi.hoisted(() => ({ playSound: vi.fn() }));
vi.mock("./sound.js", () => ({ playSound }));

import { unwireEvents, wireEvents } from "./events.js";

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

function handlerFor(pi: MockPi, channel: string): (...args: unknown[]) => void {
	const call = pi.on.mock.calls.find((c: string[]) => c[0] === channel);
	const call2 =
		call ?? pi.events.on.mock.calls.find((c: string[]) => c[0] === channel);
	if (!call2) throw new Error("no handler for " + channel);
	return call2[1];
}

beforeEach(() => {
	playSound.mockClear();
});

describe("wireEvents", () => {
	it("registers agent_settled via pi.on and prompt events via pi.events.on", () => {
		const pi = makePi();
		wire(pi);
		expect(pi.on).toHaveBeenCalledWith("agent_settled", expect.any(Function));
		expect(pi.events.on).toHaveBeenCalledWith(
			"rpiv:ask-user:prompt",
			expect.any(Function),
		);
		expect(pi.events.on).toHaveBeenCalledWith(
			"permissions:ui_prompt",
			expect.any(Function),
		);
	});

	it("plays the complete sound on agent_settled", () => {
		const pi = makePi();
		wire(pi);
		handlerFor(pi, "agent_settled")();
		expect(playSound).toHaveBeenCalledWith("c.wav");
	});

	it("plays the question sound on ask-user prompt", () => {
		const pi = makePi();
		wire(pi);
		handlerFor(pi, "rpiv:ask-user:prompt")({});
		expect(playSound).toHaveBeenCalledWith("q.wav");
	});

	it("does not play for a disabled event", () => {
		const pi = makePi();
		wire(pi);
		handlerFor(pi, "permissions:ui_prompt")({});
		expect(playSound).not.toHaveBeenCalled();
	});

	it("silences everything when the master toggle is off", () => {
		fixedConfig.sound = false;
		try {
			const pi = makePi();
			wire(pi);
			handlerFor(pi, "agent_settled")();
			expect(playSound).not.toHaveBeenCalled();
		} finally {
			fixedConfig.sound = true;
		}
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
