# Conventions — pi-notify-sound

Shared rules for all AI agents working in this repository.

## Conventional Commits & Semantic Versioning

All changes MUST follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

### Commit Message Format

`<type>(<scope>): <description>` — space after colon is MANDATORY.

### Types

- `feat` — new feature
- `fix` — bug fix
- `perf` — performance improvement
- `docs`, `chore`, `style`, `refactor`, `test` — no version bump
- `BREAKING CHANGE:` (or `!`) — major

## Git Operations

- No direct work on `main`/`master`. Every task starts on a feature branch or worktree (kickoff-branch).
- Solo profile: ship with `bash scripts/land-branch.sh <branch> "<message>"` after release-branch gates (local squash to main, then push). PR optional.
- NEVER push directly to `main`/`master` except via land-branch.sh.
- NEVER include `Co-authored-by` or AI-attribution footers in commits.
- Never call GitHub REST API directly; never create GitHub issues from automated workflows — use local specs/ files.
- Post-land cleanup: squash merge orphans the branch; use `git branch -D`.

## Agent Workflow Mandates

**AGENTS MUST NEVER BYPASS THE BIGPOWERS WORKFLOW.**

- **No Direct Coding:** A directive like "build feature X" MUST NOT be executed by writing code directly.
- **Required Skills:** Route work through bigpowers skills: survey-context → plan-work (tasks with verify:) → develop-tdd / execute-plan → verify-work. Use investigate-bug for bug reports before writing a fix.
- **Verification Mandate:** Every story MUST end with a step-by-step manual verification script. Wait for user confirmation (UAT) before declaring done.
- **Traceability Mandate:** Every story MUST carry a `story: eNNsNN` tag in implementing code or tests.

## Always Green / Shift Left

Solo developers own the whole codebase. **Always Green** means Preflight and CI are green before any forward work.

**Shift Left (1-10-100):** Defects cost ~1× in development, 10× in integration, 100× in production. Fixing a red gate now is cheaper than shipping and debugging later.

**Preflight** = `npm test && npm run typecheck`. MUST pass before kickoff, develop, or verify phases advance.
**CI green** = `gh pr checks` passing before merge or land (when remote CI applies).

## Discovered Defects

Any **reproducible gate failure** during unrelated work is a discovered defect — not optional background noise.

**fix-or-log ladder (mandatory):**

1. **quick-fix** — trivial, data-only, or single-file fixes within guardrails.
2. **fix-bug** — when quick-fix guardrails abort or investigation is needed (specs/bugs/BUG-*.md + TDD).
3. **Log** — only when reproduction is blocked after good-faith effort; write a BUG spec and stop forward work until triaged.

Discovered fixes ship in the same PR but in separate commits (Conventional Commits). Never narrate a failure and continue.

**Hard block:** Red Preflight or red CI blocks kickoff-branch, develop-tdd, and verify-work until fix-or-log produces green.

### Banned dismissive phrases

| Banned phrase | Required behavior instead |
| --------------- | --------------------------- |
| Pre-existing / pre-existing issues | Run fix-or-log; if truly unrelated, prove with a passing repro after revert |
| unrelated to this session | Same — session boundaries do not waive green gates |
| not introduced by my changes | Bisect or fix anyway; solo-default owns the whole tree |
| out of scope (ignoring a red gate) | Invoke quick-fix or fix-bug; scope-minimization never overrides Always Green |

## specs/ — All Planning Output Goes Here

Every skill that produces written output writes to `specs/` at the project root.

| Layer | File | Answers |
| ------- | ------ | --------- |
| Session | `specs/state.yaml` | Active flow, epic/bug, git, handoff.next_skill, workflow_mode |
| Release index | `specs/release-plan.yaml` | Target version, WSJF epic list |
| Progress | `specs/execution-status.yaml` | Flat story/epic status — sole SoT for story state |
| Scope / vision / glossary | `specs/product/*_LATEST.yaml` | What the product does, north star, terms |
| Epics | `specs/epics/eNN-*` | Stories and tasks with verify: |
| Bugs | `specs/bugs/BUG-*.md` + registry.yaml | RCA + fix plan |

Do not put story status in release-plan.yaml. Do not duplicate the release plan inside state.yaml.

## Code Style

- Functions 4–20 lines. Files under 300 lines.
- One thing per function, one responsibility per module (SRP).
- Names specific and unique. No `any`, no untyped public functions.
- No code duplication. Early returns over nested ifs; max 2 levels of indentation.
- No magic strings/numbers — extract to named constants.
- Prefer exceptions over error codes.
- Remove dead code; never comment it out.
- Boy Scout Rule: leave every file at least as clean as found.

## Comments

- Keep your own comments; they carry intent and provenance.
- Write WHY, not WHAT.
- No commented-out code (C5) — use git history.
- Reference commit SHAs when a line exists because of a specific bug.

## Tests (F.I.R.S.T — Uncle Bob Ch 9)

- Tests run headless with a single command: `npm test` (vitest).
- Every new function gets a test. Every bug fix gets a regression test.
- Tests are **F**ast, **I**ndependent, **R**epeatable, **S**elf-Validating, **T**imely.
- Never skip or @ignore a test without an explicit ambiguity note.
- Test boundary conditions (T5): empty, minimum, maximum, off-by-one.
- Test through public interfaces only (T8) — never assert internal state or private methods.
- Every change must be verifiable with a single runnable command before done.

## Defensive Code

The agent implements defensive code only for these categories:

- **Timeout** — long-running operations: playback must never block the event loop; spawn is fire-and-forget with a hidden window.
- **Graceful degradation** — missing wav, muted config, or playback failure MUST silently skip. The extension never throws from event handlers.

## Dependencies

- Inject dependencies through constructor/parameter, not global/import.
- Wrap third-party libs behind a thin project-owned interface.
- Zero runtime dependencies is a hard convention in this repo.

## Structure

- Predictable paths: logic in src/, tests co-located (src/*.test.ts).
- Prefer small focused modules over god files.

## Formatting

- Tab indentation enforced by pi-lens on-save; no style debates.

## Logging

- No logging required for a notification extension; if added, plain text to stderr only.
