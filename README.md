# pi-notify-sound

A [pi](https://github.com/badlogic/pi-mono) extension that plays a sound when
the agent finishes and when it waits for your input — so you can leave the
terminal and still hear when it's your turn.

## Quick start

```bash
pi install git:github.com/callmechristian/pi-notify-sound
```

Then in pi: `/reload`, then `/notify-sound test` to hear it. Config is
optional — bundled sounds work out of the box. For guided configuration, ask
pi for **notify-sound-setup** (a skill shipped with the extension).

## What triggers a sound

| Moment | Event | Default sound |
| -------- | ------- | --------------- |
| Agent fully done (no retry/compaction/follow-up pending) | `agent_settled` | `complete` |
| Questionnaire awaiting your answer | `rpiv:ask-user:prompt` | dingding |
| Permission prompt awaiting a decision | `permissions:ui_prompt` | dingding |
| A tool call failed (opt-in) | `tool_execution_end` (`isError`) | grand piano — off by default |
| Run interrupted — provider error, model stop, user abort | `agent_end` final `stopReason` = `error`/`aborted` | grand piano |
| Session ends (opt-in) | `session_shutdown` | dingding |

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

**Install from npm:**

```bash
pi install npm:pi-notify-sound
```

Needs a published release (see [Publishing to npm](#publishing-to-npm) below);
then `/reload`.

**Update after new releases:** `pi update pi-notify-sound` (or `pi update`),
then `/reload`.

**Dev from a clone:** instead of `pi install`, junction the repo into
`~/.pi/agent/extensions/notify-sound` (auto-discovered, hot-reload via
`/reload`). Don't do both — the extension would register twice and play
sounds twice per event.

## Publishing to npm

Releases publish automatically to npm via GitHub Actions (`.github/workflows/publish.yml`),
triggered by any `v*` tag. The workflow verifies (`npm ci` → `npm test` →
`npm run typecheck`) and publishes with npm trusted publishing (OIDC +
provenance) — no token secret needed.

**One-time npm setup (trusted publishing):**

1. npmjs.com → Access → **Trusted Publishers** → Add publisher
2. GitHub repo: `callmechristian/pi-notify-sound` (workflow: `publish`)

**Release flow:**

```bash
npm version patch -m "chore: release v%s"
git push --follow-tags
```

GitHub Actions builds and publishes `pi-notify-sound@<version>`; then
`pi update pi-notify-sound` on the pi side.

## Config

**Optional.** The extension ships with bundled sounds (`src/sounds/`) and works
with no config file at all. A template is written to
`~/.pi/notify-sound/config.json` on first run — every event defaults to its
bundled sound:

```json
{
  "sound": true,
  "cooldown_ms": 10000,
  "suppressWhenFocused": false,
  "events": {
    "agent_settled":       { "sound": "default" },
    "ask_user_prompt":     { "sound": "default" },
    "permission_request":  { "sound": "default" },
    "tool_error":          { "sound": null },
    "breaking_error":      { "sound": "default" },
    "session_shutdown":    { "sound": null }
  }
}
```

- `sound: false` mutes everything.
- `cooldown_ms` — minimum ms between any two sounds (global dedupe, default
  10000; 0 disables). Prevents sound storms on tool-error retries.
- `suppressWhenFocused` — Windows only: skip playback while the pi terminal is
  the foreground window (default false).
- Each `events.<key>.sound` is one of:
  - `"default"` — the bundled default sound for that event
    (dingding for everything; the grand-piano sample plays only for tool errors)
  - `null` — disabled, no sound
  - an absolute wav path — a custom sound (missing files fall back to the bundled default)
- Config is read at fire-time — edits apply without a reload.
- **Per-project config:** add a `.pi/notify-sound.json` file in a repo to overlay
  the global config for that project (fields merge; event sounds merge per key).
  Only applied for trusted projects.
- **Errors are opt-in except breaking ones:** `breaking_error` (run interrupted —
  provider timeout, model stop, abort) plays by default; `tool_error` (a failed
  tool call like a wrong bash command) stays silent unless you set
  `"tool_error": { "sound": "default" }` or a path explicitly.

## Bundled sounds

The package bundles two short freesound.org samples:

- `dingding.wav` — the default for every event (`sound: "default"`)
- `studio-grand-notification.wav` — reserved for tool errors (the `tool_error`
  event plays it when a tool call fails)

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
