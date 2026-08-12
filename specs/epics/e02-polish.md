# Epic e02 — sound polish

Six small improvements to pi-notify-sound. All verified with the existing gates.

| ID | Story | verify |
| ---- | ------- | -------- |
| e02s01 | **Cooldown (rate-limit)** — at most one sound per `cooldown_ms` across all events; prevents tool-error storms | events.test cooldown cases; `npm test` |
| e02s02 | **suppressWhenFocused** — Windows: skip playback while the pi terminal is the foreground window (opt-in, default off) | focus.ts + events.test with mocked focus; `npm test` |
| e02s03 | **Config normalization** — loaded JSON is type-checked/coerced (`sound` bool, `cooldown_ms` number >= 0, `suppressWhenFocused` bool, event `sound` default/null/path); malformed values fall back to defaults | config.test normalize cases; `npm test` |
| e02s04 | **Per-project config** — `.pi/notify-sound.json` overlays the global config when the project is trusted | loadProjectConfig + mergeConfigs tests; `npm test` |
| e02s05 | **Opt-in session-end sound** — `session_shutdown` event, default `null` (silent); `"default"` plays dingding | events.test registration + default/enabled cases |
| e02s06 | **Test sound dispatch + command parsing** — extract `choosePlayer` / `parseTestTarget` / `buildStatusLines`; `/notify-sound test <path>` reports missing files | sound.test.ts + index.test.ts; `npm test` |
| e02s07 | **Breaking vs tool errors** — `breaking_error` (run interrupted: `agent_end` final `stopReason` `error`/`aborted`) plays the piano by default; `tool_error` (failed tool call) is opt-in (default `null`) | events.test agent_end cases; `npm test` |

Gates: `npm test` (all suites), `npm run typecheck`, agentic-STE validator on CLAUDE.md/CONVENTIONS.md, specs-yaml validator.
