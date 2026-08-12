# pi-notify-sound

A [pi](https://github.com/badlogic/pi-mono) extension that plays a sound when
the agent finishes and when it waits for your input — so you can leave the
terminal and still hear when it's your turn.

## What triggers a sound

| Moment | Event | Default sound |
| -------- | ------- | --------------- |
| Agent fully done (no retry/compaction/follow-up pending) | `agent_settled` | `complete` |
| Questionnaire awaiting your answer | `rpiv:ask-user:prompt` | `question` |
| Permission prompt awaiting a decision | `permissions:ui_prompt` | `question` |

`agent_settled` is used instead of `agent_end` because `agent_end` fires
before pi decides whether to auto-retry, compact-and-retry, or run follow-ups.

## Install

The extension is zero-dependency (Node built-ins only) and ships its own
notification sounds (`src/sounds/`).

**Install from GitHub:**

```bash
pi install git:github.com/callmechristian/pi-notify-sound
```

Then run `/reload` in pi. The package lands in
`~/.pi/agent/git/github.com/callmechristian/pi-notify-sound`.

**Dev from a clone:** instead of `pi install`, junction the repo into
`~/.pi/agent/extensions/notify-sound` (auto-discovered, hot-reload via
`/reload`). Don't do both — the extension would register twice and play
sounds twice per event.

## Config

**Optional.** The extension ships with bundled sounds (`src/sounds/`) and works
with no config file at all. A template is written to
`~/.pi/notify-sound/config.json` on first run — every event defaults to its
bundled sound:

```json
{
  "sound": true,
  "events": {
    "agent_settled":       { "sound": "default" },
    "ask_user_prompt":     { "sound": "default" },
    "permission_request":  { "sound": "default" }
  }
}
```

- `sound: false` mutes everything.
- Each `events.<key>.sound` is one of:
  - `"default"` — the bundled default sound for that event
    (agent done → studio-grand notification; questions/permissions → dingding)
  - `null` — disabled, no sound
  - an absolute wav path — a custom sound (missing files fall back to the bundled default)
- Config is read at fire-time — edits apply without a reload.

## Bundled sounds

The package bundles two short freesound.org samples:

- `studio-grand-notification.wav` — agent done (`sound: "default"`)
- `dingding.wav` — questions and permission prompts

Override with a custom wav path per event, or disable an event with `null`.

## Verify

`/notify-sound` — shows current config.
`/notify-sound test` — plays the agent-done sound.
`/notify-sound test question` — plays the question sound (`/notify-sound test done|permission` work too; pass a wav path to play it directly).

## Playback notes

- **Windows:** hidden PowerShell using `[System.Media.SoundPlayer]` with
  `PlaySync()`, spawned with an args array (no shell). The child must NOT be
  spawned `detached` — a detached child gets a fresh console whose audio
  endpoint is unavailable, so `PlaySync()` returns instantly and nothing plays.
- **macOS:** `afplay`. **Linux:** `paplay` (falls back to `aplay`).
- Playback is fire-and-forget and never throws; a missing file or muted config
  is silently skipped.

## Development

```bash
npm install     # devDeps: typescript, @types/node, pi types
npx tsc --noEmit
```
