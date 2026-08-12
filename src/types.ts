/**
 * pi-notify-sound — configuration types.
 */

/** The pi events this extension can react to. */
export type NotifyEventKey =
	| "agent_settled"
	| "ask_user_prompt"
	| "permission_request"
	| "tool_error"
	| "breaking_error"
	| "session_shutdown";

/**
 * Per-event sound value:
 * - "default" → the bundled default sound for that event
 * - null      → disabled (silent)
 * - a string  → a valid wav path to play
 */
export type SoundValue = "default" | null | string;

/** Per-event wiring. */
export interface EventSoundConfig {
	sound: SoundValue;
}

/** Full extension config. Optional — bundled defaults apply without it. */
export interface NotifySoundConfig {
	/** Master toggle — `false` mutes everything. */
	sound: boolean;
	/**
	 * Minimum ms between any two sounds (global dedupe across events).
	 * Prevents sound storms on tool-error retries. 0 disables.
	 */
	cooldown_ms: number;
	/**
	 * Windows only: skip playback while the pi terminal is the foreground
	 * window, so you aren't dinging while you're looking at the terminal.
	 */
	suppressWhenFocused: boolean;
	/** Per-event wiring. */
	events: Record<NotifyEventKey, EventSoundConfig>;
}
