/**
 * pi-notify-sound — configuration types.
 */

/** The pi events this extension can react to. */
export type NotifyEventKey =
	| "agent_settled"
	| "ask_user_prompt"
	| "permission_request";

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
	/** Per-event wiring. */
	events: Record<NotifyEventKey, EventSoundConfig>;
}
