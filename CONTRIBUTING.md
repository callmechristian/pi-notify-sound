# Contributing to pi-notify-sound

Thanks for contributing! The project is small and conventions-first — read
`CONVENTIONS.md` before any GitHub or git operation.

## Development setup

```bash
git clone https://github.com/callmechristian/pi-notify-sound
cd pi-notify-sound
npm install          # devDeps: typescript, vitest, @types/node, pi types
npm run typecheck    # tsc --noEmit
npm test             # vitest
```

No build step — the extension is jiti-loaded TypeScript, run through pi.

## Trying it locally

The repo is a pi extension. Either junction it into
`~/.pi/agent/extensions/notify-sound` (auto-discovered, hot-reload via
`/reload`) or install from the remote with `pi install
git:github.com/callmechristian/pi-notify-sound`. Never do both — the
extension would register twice and play sounds twice per event.

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`,
  `style:`, `chore:`, `refactor:`). No AI-attribution footers.
- **Zero runtime dependencies:** Node built-ins only. Type-only imports from
  `@earendil-works/pi-coding-agent` are fine; value imports add a runtime dep.
- **Config is user-owned:** read at fire-time, never cached; never write
  machine state (`~/.pi/notify-sound/config.json`) from the repo.
- **Graceful degradation:** playback must never throw from event handlers;
  missing files and muted config silently skip.
- **Defensive categories in effect:** timeout (fire-and-forget spawn) and
  graceful degradation only.

## Gates (must be green before merge)

```bash
npm test && npm run typecheck        # Preflight
bash <bigpowers>/scripts/validate-agentic-ste.sh --strict CLAUDE.md CONVENTIONS.md
bash <bigpowers>/scripts/validate-specs-yaml.sh specs
```

Every change needs a test (F.I.R.S.T). Tests live co-located:
`src/*.test.ts`.

## Workflow

- Work on a branch from `main` (`kickoff-branch`); never commit directly to
  `main`.
- Plan changes in `specs/` first (epics, stories with `verify:` commands).
- Bug discovered mid-work: fix-or-log — `quick-fix` for trivial fixes,
  `specs/bugs/BUG-*.md` + TDD for anything needing investigation.
- Issues during implementation stay local (`specs/bugs/`); explicit
  issue-finding sessions and user-initiated issues go to GitHub Issues
  (see `docs/agents/issue-tracker.md`).

## Release

Tag a version and the CI pipeline publishes to npm (trusted publishing):

```bash
npm version patch -m "chore: release v%s"
git push --follow-tags
```

See `.github/workflows/publish.yml` and README § Publishing to npm.
