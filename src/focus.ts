/**
 * pi-notify-sound — terminal-focus detection (Windows).
 *
 * Determines whether the pi terminal owns the foreground window, for the
 * `suppressWhenFocused` config. macOS/Linux have no implementation — always
 * returns false so playback is never blocked there.
 *
 * Approach: the spawned PowerShell walks its own parent-process chain
 * (powershell ← node ← shell ← terminal). The terminal is focused when the
 * foreground window's PID is in that chain.
 */

import { spawn } from "node:child_process";
import { platform } from "node:os";

const FOCUS_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class F {
	[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
	[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
}
"@
$fg = [F]::GetForegroundWindow()
$fgp = [uint32]0
[F]::GetWindowThreadProcessId($fg, [ref]$fgp) | Out-Null
$cur = $PID
$chain = @()
$p = Get-CimInstance Win32_Process -Filter "ProcessId=$cur" -ErrorAction SilentlyContinue
while ($p -and $p.ProcessId -ne $p.ParentProcessId) {
	$chain += $p.ProcessId
	$next = $p.ParentProcessId
	if ($next -eq 0) { break }
	$p = Get-CimInstance Win32_Process -Filter "ProcessId=$next" -ErrorAction SilentlyContinue
}
[pscustomobject]@{ foreground = $fgp; chain = $chain } | ConvertTo-Json -Compress
`.trim();

/** True when the pi terminal owns the foreground window (Windows only). */
export function isWindowFocused(): Promise<boolean> {
	if (platform() !== "win32") return Promise.resolve(false);
	return new Promise((resolve) => {
		let out = "";
		const child = spawn(
			"powershell.exe",
			["-NoProfile", "-WindowStyle", "Hidden", "-Command", FOCUS_SCRIPT],
			{ stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
		);
		const timer = setTimeout(() => {
			child.kill();
			resolve(false);
		}, 1500);
		timer.unref?.();
		child.stdout.on("data", (d: Buffer) => {
			out += d.toString();
		});
		child.on("error", () => {
			clearTimeout(timer);
			resolve(false);
		});
		child.on("close", () => {
			clearTimeout(timer);
			try {
				const j = JSON.parse(out.trim()) as {
					foreground?: number;
					chain?: number[];
				};
				const chain = new Set((j.chain ?? []).map(Number));
				resolve(chain.has(Number(j.foreground)));
			} catch {
				resolve(false);
			}
		});
	});
}
