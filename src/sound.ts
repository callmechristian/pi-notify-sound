/**
 * pi-notify-sound — sound playback.
 *
 * Fire-and-forget; never throws. Playback is detached so it never blocks pi.
 *
 * Windows: hidden PowerShell using [System.Media.SoundPlayer] via PlaySync.
 * NOT detached — a detached child gets a fresh console whose audio endpoint
 * is unavailable, so PlaySync returns instantly without playing.
 * macOS: afplay. Linux: paplay, falling back to aplay.
 *
 * Every spawn() call below uses a literal executable (semgrep rule:
 * detect-child-process). choosePlayer() is the single source of the command;
 * playSound() dispatches on the known player literals.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";

/** A platform playback command. `windows` marks the SoundPlayer variant. */
export interface PlayerCommand {
	file: string;
	args: string[];
	windows: boolean;
}

/** Pick the playback command for a platform and wav path, or null when unsupported. */
export function choosePlayer(
	os: NodeJS.Platform,
	path: string,
): PlayerCommand | null {
	if (os === "win32") {
		const script =
			"[System.Media.SoundPlayer]::new('" +
			path.replace(/'/g, "''") +
			"').PlaySync()";
		return {
			file: "powershell.exe",
			args: ["-NoProfile", "-WindowStyle", "Hidden", "-Command", script],
			windows: true,
		};
	}
	if (os === "darwin") return { file: "afplay", args: [path], windows: false };
	if (os === "linux") return { file: "paplay", args: [path], windows: false };
	return null;
}

/** Play a wav file fire-and-forget. Returns immediately. */
export function playSound(path: string): void {
	if (!path || !existsSync(path)) return;
	try {
		const cmd = choosePlayer(platform(), path);
		if (!cmd) return;
		if (cmd.file === "powershell.exe") {
			spawn("powershell.exe", cmd.args, {
				stdio: "ignore",
				windowsHide: true,
			}).unref();
		} else if (cmd.file === "afplay") {
			spawn("afplay", cmd.args, { stdio: "ignore", detached: true }).unref();
		} else if (cmd.file === "paplay") {
			const child = spawn("paplay", cmd.args, {
				stdio: "ignore",
				detached: true,
			});
			child.on("error", () => {
				spawn("aplay", cmd.args, { stdio: "ignore", detached: true }).unref();
			});
			child.unref();
		}
	} catch {
		// Sound playback failure is non-blocking.
	}
}
