/**
 * pi-notify-sound — configuration types.
 */

/** Named sounds referenced by config. Keys are stable; paths are absolute wav paths. */
export type SoundKey = "default" | "complete" | "question" | "error";

/** The pi events this extension can react to. */
export type NotifyEventKey = "agent_settled" | "ask_user_prompt" | "permission_request";

/** Per-event wiring. */
export interface EventSoundConfig {
  /** Whether this event triggers a sound. */
  enabled: boolean;
  /** Sound key (into `sounds`) or an absolute wav path. Falls back to `sounds.default`. */
  sound?: SoundKey | string;
}

/** Full extension config. */
export interface NotifySoundConfig {
  /** Master toggle — `false` mutes everything. */
  sound: boolean;
  /** Named sounds, keyed by SoundKey. */
  sounds: Record<SoundKey, string>;
  /** Per-event wiring. */
  events: Record<NotifyEventKey, EventSoundConfig>;
}
