---
name: notify-sound-setup
description: >-
  Guided setup for the pi-notify-sound extension (plays a sound when the agent
  finishes or waits for your input). Walks through the config surface, then —
  with the user's explicit permission — writes ~/.pi/notify-sound/config.json
  and optionally a per-project <cwd>/.pi/notify-sound.json overlay.
---

# Setup pi-notify-sound

Guide the user through configuring the pi-notify-sound extension. The skill
presents options and, if allowed, writes the config files.

## Step 1 — Check the install

- Run `pi list` and confirm `pi-notify-sound` is present.
- In pi, `/notify-sound` prints the current effective config (toggles +
  per-event resolution). Read `~/.pi/notify-sound/config.json` if it exists
  (it may not — the config is optional).
- If the extension isn't installed, offer the install command and stop:
  `pi install git:github.com/callmechristian/pi-notify-sound` then `/reload`.

## Step 2 — Explain the config surface

| Key | Meaning | Default |
| ----- | --------- | --------- |
| `sound` | master toggle | `true` |
| `cooldown_ms` | min ms between any two sounds (global dedupe; 0 = off) | `10000` |
| `suppressWhenFocused` | Windows: skip while the pi terminal is focused | `false` |
| `events.<key>.sound` | per-event: `"default"` (bundled) \| `null` (off) \| wav path | event-dependent |
| `.pi/notify-sound.json` | per-project overlay (trusted projects only) | none |

Bundled sounds: `dingding.wav` is the default for every event; the
`studio-grand-notification.wav` sample is reserved for `tool_error`.
Custom sounds: any absolute wav path (missing files fall back to bundled).

Events: `agent_settled` (agent done), `ask_user_prompt` (question),
`permission_request` (permission prompt), `tool_error` (failed tool call),
`session_shutdown` (session end — opt-in, default `null`).

## Step 3 — Ask what the user wants

Present the defaults above and ask, one decision at a time (accept the
default in a word):

1. Master toggle on/off.
2. Cooldown: keep 10s, change, or disable (0).
3. `suppressWhenFocused` on/off (Windows only).
4. Per-event sounds: keep bundled defaults, disable any event (`null`), or
   point an event at a custom wav path.
5. Per-project overlay for this repo (`<cwd>/.pi/notify-sound.json`) or
   global only.

## Step 4 — Write the config (only with permission)

- Ask explicitly before writing or changing `~/.pi/notify-sound/config.json`.
- If a config already exists, show the diff of what will change and get an
  explicit OK — never clobber silently.
- Build the JSON with the chosen values; every event key must be present with
  a `sound` value (`"default"` \| `null` \| path).
- For the per-project overlay, create `<cwd>/.pi/notify-sound.json` with only
  the fields that differ from the global config (partial files merge fine).
- Config is read at fire-time — no `/reload` needed for config changes.

## Step 5 — Verify

- Run `/notify-sound` — confirm the printed values match what was chosen.
- Run `/notify-sound test` (agent-done ding) and `/notify-sound test error`
  (piano) so the user hears the sounds.

## Hard rules

- The user's config is user-owned: never edit it outside this skill flow
  without asking; never write machine state from repo code.
- If the user declines writing anything, stop after Step 3 and leave the
  defaults in place.
