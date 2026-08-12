/**
 * pi-notify-sound — sound playback.
 *
 * Fire-and-forget; never throws. Playback is detached so it never blocks pi.
 *
 * Windows: hidden PowerShell using [System.Media.SoundPlayer] via PlaySync.
 * NOT detached — a detached child gets a fresh console whose audio endpoint
 * is unavailable, so PlaySync returns instantly without playing.
 * macOS: afplay. Linux: paplay, falling back to aplay.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";

/** Play a wav file fire-and-forget. Returns immediately. */
export function playSound(path: string): void {
  if (!path || !existsSync(path)) return;
  try {
    const os = platform();
    if (os === "win32") playWindows(path);
    else if (os === "darwin") spawnDetached("afplay", [path]);
    else spawnDetached("paplay", [path]);
  } catch {
    // Sound playback failure is non-blocking.
  }
}

/** Windows: args-array spawn (no shell), detached hidden PowerShell, PlaySync. */
function playWindows(path: string): void {
  const script = "[System.Media.SoundPlayer]::new('" + path.replace(/'/g, "''") + "').PlaySync()";
  spawn(
    "powershell.exe",
    ["-NoProfile", "-WindowStyle", "Hidden", "-Command", script],
    { stdio: "ignore", windowsHide: true }
  ).unref();
}

/**
 * Spawn a background process; on missing binary, try the Linux fallback once.
 * NOTE: detached:true on Windows breaks SoundPlayer audio (fresh console has
 * no audio endpoint), so it is used only on POSIX where it protects the
 * child from SIGHUP when pi exits.
 */
function spawnDetached(file: string, args: string[]): void {
  const opts = platform() === "win32"
    ? { stdio: "ignore" as const, windowsHide: true }
    : { stdio: "ignore" as const, detached: true };
  const child = spawn(file, args, opts);
  child.on("error", () => {
    if (file === "paplay") spawnDetached("aplay", args);
  });
  child.unref();
}