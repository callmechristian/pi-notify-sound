import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { choosePlayer, playSound } from "./sound.js";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

let currentPlatform: NodeJS.Platform = "win32";
vi.mock("node:os", () => ({ platform: () => currentPlatform }));

/** A fake spawn child that records handlers and can emit events. */
function fakeChild() {
	const emitter = new EventEmitter();
	const child = emitter as EventEmitter & { unref: ReturnType<typeof vi.fn> };
	child.unref = vi.fn();
	return child;
}

beforeEach(() => {
	spawnMock.mockReset();
	spawnMock.mockImplementation(() => fakeChild());
	currentPlatform = "win32";
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("choosePlayer", () => {
	it("builds a SoundPlayer command on win32 with the path escaped", () => {
		const cmd = choosePlayer("win32", "E:\\a b'c.wav");
		expect(cmd).not.toBeNull();
		expect(cmd!.file).toBe("powershell.exe");
		expect(cmd!.windows).toBe(true);
		expect(cmd!.args.join(" ")).toContain("a b''c.wav");
		expect(cmd!.args.join(" ")).toContain("PlaySync()");
	});

	it("uses afplay on darwin and paplay on linux", () => {
		expect(choosePlayer("darwin", "x.wav")?.file).toBe("afplay");
		expect(choosePlayer("linux", "x.wav")?.file).toBe("paplay");
	});

	it("returns null on unsupported platforms", () => {
		expect(choosePlayer("freebsd", "x.wav")).toBeNull();
	});
});

describe("playSound", () => {
	it("does nothing for an empty or missing path", () => {
		playSound("");
		playSound("Z:\\definitely-missing.wav");
		expect(spawnMock).not.toHaveBeenCalled();
	});

	it("spawns powershell (not detached) for an existing wav on win32", () => {
		currentPlatform = "win32";
		playSound(__filename);
		expect(spawnMock).toHaveBeenCalledTimes(1);
		const [file, args, opts] = spawnMock.mock.calls[0];
		expect(file).toBe("powershell.exe");
		expect(args[0]).toBe("-NoProfile");
		expect(opts.detached).toBeUndefined();
		expect(opts.windowsHide).toBe(true);
	});

	it("spawns afplay detached on darwin", () => {
		currentPlatform = "darwin";
		playSound(__filename);
		expect(spawnMock).toHaveBeenCalledWith(
			"afplay",
			[__filename],
			expect.objectContaining({ detached: true }),
		);
	});

	it("falls back to aplay when paplay is missing", () => {
		currentPlatform = "linux";
		const first = fakeChild();
		spawnMock.mockReturnValueOnce(first);
		playSound(__filename);
		expect(spawnMock).toHaveBeenNthCalledWith(
			1,
			"paplay",
			[__filename],
			expect.anything(),
		);
		// emit the error → fallback to aplay
		const errorHandler = first.listeners("error")[0] as () => void;
		errorHandler();
		expect(spawnMock).toHaveBeenNthCalledWith(
			2,
			"aplay",
			[__filename],
			expect.anything(),
		);
	});

	it("does nothing on an unsupported platform", () => {
		currentPlatform = "freebsd";
		playSound(__filename);
		expect(spawnMock).not.toHaveBeenCalled();
	});
});
