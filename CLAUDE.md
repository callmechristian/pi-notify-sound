# pi-notify-sound — Claude Code

Read CONVENTIONS.md before any GitHub or git operation.

## Project

Pi extension that plays a sound when the agent finishes or waits for your input (questions, permission prompts).
Stack: TypeScript / Node — pi extension runtime, jiti-loaded, no build step.

## Commands

| Action | Command |
|--------|---------|
| Run    | pi extension — load via `/reload` in pi |
| Test   | `npm test` (vitest) |
| Build  | `npm run typecheck` (tsc --noEmit) |
| Lint   | none configured — typecheck is the gate |
| Preflight | `npm test && npm run typecheck` |
| CI     | `gh pr checks` (when a PR is open) |

## Architecture

src/index.ts wires events to playback. src/events.ts maps pi lifecycle and event-bus signals to sounds. src/sound.ts plays wavs fire-and-forget (PowerShell SoundPlayer on Windows; afplay/paplay elsewhere). src/config.ts loads ~/.pi/notify-sound/config.json at fire-time. src/types.ts defines the config schema.

## Conventions

- MUST use Conventional Commits (feat:, fix:, docs:, style:).
- MUST keep zero runtime dependencies; Node built-ins only.
- MUST read config at fire-time; NEVER cache it in memory.
- MUST play sounds fire-and-forget; NEVER throw from event handlers.
- MUST skip silently on missing file or muted config.

## Never

- NEVER dismiss reproducible gate failures as pre-existing or out of scope.
- NEVER proceed on red Preflight or red CI; invoke quick-fix or fix-bug first.
- NEVER write machine state from this repo; config lives in ~/.pi/notify-sound/config.json.
- NEVER spawn Windows playback with detached:true; audio silently fails.

## Agent Rules

- **Workflow Mandate:** You MUST use the bigpowers skills (plan-work, develop-tdd, orchestrate-project) to perform tasks. DO NOT write code directly in response to a user prompt like "build this feature".
- **Always Green:** Preflight and CI must be green before forward work. Reproducible gate failures require fix-or-log (quick-fix → fix-bug) per CONVENTIONS § Discovered Defects.
- Read specs/ before writing code.
- All planning and specifications MUST be written to specs/ (product/SCOPE_LATEST.yaml, release-plan.yaml, epics/) before any code is generated.
- Write the minimum code that solves the stated problem. Nothing extra.
- Run tests after every change. Show evidence before declaring done.
- One clarifying question beats a wrong assumption baked into 200 lines.

## Agent skills

### Issue tracker

Hybrid: defects found during implementation → local `specs/bugs/` (bigpowers); explicit issue-finding sessions and user-initiated issues → GitHub Issues. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
