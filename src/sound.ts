/**
 * pi-notify-sound — sound playback.
 *
 * Fire-and-forget; never throws. Playback is detached so it never blocks pi.
 *
 * Windows: detached hidden PowerShell using [System.Media.SoundPlayer] via
 * PlaySync (proven reliable on this machine; keep wavs <= ~3s — long wavs
 * from a spawned process are silently dropped).
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
    { stdio: "ignore", detached: true, windowsHide: true }
  ).unref();
}

/** Spawn a detached process; on missing binary, try the Linux fallback once. */
function spawnDetached(file: string, args: string[]): void {
  const child = spawn(file, args, { stdio: "ignore", detached: true });
  child.on("error", () => {
    if (file === "paplay") spawnDetached("aplay", args);
  });
  child.unref();
}
