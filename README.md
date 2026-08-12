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

The extension is zero-dependency (Node built-ins only). Point pi at the repo
however you prefer:

- **Junction (dev, hot-reload via `/reload`):**

  ```powershell
  mklink /J "%USERPROFILE%\.pi\agent\extensions\notify-sound" "E:\Projects\pi-notify-sound"
  ```

- **Copy:** put the repo (or `src/`) under `~/.pi/agent/extensions/notify-sound/`.
- **pi package:** `pi install git:<this-repo-url>` once it has a remote
  (`pi.extensions` is declared in `package.json`).

Then run `/reload` in pi.

## Config

`~/.pi/notify-sound/config.json`. The extension ships with bundled sounds
(`src/sounds/`), so a fresh install plays out of the box — the config only needs
to exist if you want to override them:

```json
{
  "sound": true,
  "events": {
    "agent_settled":       { "enabled": true, "sound": "complete" },
    "ask_user_prompt":     { "enabled": true, "sound": "question" },
    "permission_request":  { "enabled": true, "sound": "question" }
  }
}
```

- `sound: false` mutes everything.
- `sounds` maps a name to an absolute wav path (optional — bundled sounds are
  the default). `default` is the fallback when an event has no `sound` set.
- Each `events.<key>.sound` is either a key into `sounds` or a direct wav path.
- Config is read at fire-time — edits apply without a reload.

## Bundled sounds

The package bundles two short freesound.org samples:

- `studio-grand-notification.wav` — complete / error / default
- `dingding.wav` — questions and permission prompts

Override any of them via `sounds` in the config with your own wav paths.

## Verify

`/notify-sound` — shows current config.
`/notify-sound test` — plays the default sound.
`/notify-sound test question` — plays the question sound (or pass a path).

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
