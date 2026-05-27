# Refactor #4 — Decompose the large files

> **Status: DONE (2026-05-27).** All three primary targets split with zero
> behavior change; `@/lib/rules`, `@/lib/plex`, and the RuleModal import path all
> still resolve. `tsc` shows only the known stale `.next/types` errors, `vitest`
> is green, and the dev server compiles. The rules modal was manually verified in
> the running app — create/edit/save works for every rule type with no errors.
> Commits: `18cd84c` (rules), `9b3d302`
> (plex), `dcd767f` (RuleModal), `a854528` (rules-schedule extraction). The
> optional secondary targets (`tautulli/api/route.ts`, `settings/import/page.tsx`,
> `setup/page.tsx`) and the `user_stats.ts` `as any` cleanup below remain pending.
>
> Items #1–#3 of the database rehaul were already done (see "Context" below).

## Context: what came before

This is step #4 of a planned, incremental rehaul of Plexmo's backend. The earlier
steps are complete and live on the `refactor` branch (verify with `git log`):

1. **Versioned migrations** — replaced the `try/catch ALTER` blob in `src/lib/db.ts`
   with an ordered, version-tracked runner in `src/lib/migrations.ts`
   (`schema_migrations` table). To add schema changes, append a migration there.
2. **Typed DB layer** — `src/lib/db-types.ts` holds one raw-row interface per table
   (`ServerRow`, `UserRow`, …). Queries use `db.prepare<Params, Row>()` generics
   instead of `as any`. Domain types (`DiscordWebhook`, `Job`, `RuleInstance`) map
   from raw rows. `RuleInstance` is shared via `src/features/rules/types.ts`.
3. **SQL out of routes** — no file under `src/app/api/` runs raw SQL anymore; all DB
   access goes through `src/lib/` functions. New helpers were added to `discord.ts`,
   `users.ts`, `history.ts`, `rules.ts`, `servers.ts`.

**#4 (this doc) is the last structural item.** It is the most invasive because it
moves code between files rather than just retyping it. Do it last and lazily.

## Goal

Three files are 900+ lines and mix multiple responsibilities. Split each along its
existing internal seams into focused modules, **with zero behavior change**. This is
pure mechanical extraction: move code, fix imports, keep public APIs identical.

Current sizes (re-measure before starting — they drift):

| File | Lines | Why it's big |
|------|------:|--------------|
| `src/features/rules/components/settings/RuleModal.tsx` | ~929 | One React component doing 4 rule-type forms + assignment UI + webhook picker |
| `src/lib/plex.ts` | ~922 | Plex API client: types + fetch + session parsing + users + libraries |
| `src/lib/rules.ts` | ~905 | Rule CRUD + assignment/event helpers + the big enforcement engine |

Secondary (optional, lower priority): `tautulli/api/route.ts` (~668),
`settings/import/page.tsx` (~666), `setup/page.tsx` (~571).

## Guardrails (read before touching anything)

- **No behavior change.** This is refactor-only. If you find a bug, note it; don't
  fix it in the same change unless asked.
- **Keep public APIs stable.** Other files import from these modules. Either keep the
  same export names from the same path, or re-export from the original path so call
  sites don't change. Example: if you move `checkAndLogViolations` out of `rules.ts`,
  add `export { checkAndLogViolations } from "./rules-enforcement"` back in `rules.ts`.
- **Verify after every file split**, not just at the end:
  - `npx tsc --noEmit -p tsconfig.json` — **filter out** the ~13 known-stale errors in
    `.next/types/validator.ts` (leftovers from deleted statistics/library-groups
    routes; unrelated to this work). Command:
    `npx tsc --noEmit 2>&1 | grep -v "^.next/types/validator.ts" | grep "error TS"`
    Expect zero lines.
  - `npx vitest run` — should stay green (note: test coverage is thin).
  - Dev server (`npm run dev`) should hot-reload with `✓ Compiled`.
- **One file per commit.** Split `rules.ts`, verify, commit. Then `plex.ts`. Then
  `RuleModal.tsx`. Small reviewable diffs.
- Match the existing import style (`@/*` alias maps to `src/*`).

---

## Target 1: `src/lib/rules.ts` (~905 lines) — recommended FIRST

Cleanest seams, highest payoff. The file has three distinct concerns already grouped
by line range:

- **CRUD** (~lines 34–202): `getRuleInstances`, `getRuleInstance`, `createRuleInstance`,
  `updateRuleInstance`, `deleteRuleInstance`.
- **Assignment + event helpers** (~203–338): `getRuleUsers`, `toggleUserRule`,
  `getRuleServers`, `getRuleAssignmentIds`, `getEnabledServersForRule`,
  `toggleServerRule`, `logRuleEvent`, `closeRuleEvent`, `deleteRuleEvent`,
  `updateRuleEventDetails`.
- **Enforcement engine** (~339–822): `isTimeInWindow`, `isUserBlockedBySchedule`, and
  the ~450-line `checkAndLogViolations` (the heaviest single function in the file).
- **Read helpers** (~823–905): `RuleEventRow`, `getUserRuleHistory`, `getGlobalRules`,
  `getUserRules`.

### Proposed split
```
src/lib/rules/
  index.ts            // re-exports everything; preserves "@/lib/rules" import path
  rules-crud.ts       // CRUD + read helpers (getGlobalRules, getUserRules, history)
  rules-assignments.ts// user/server assignment + rule_event helpers
  rules-enforcement.ts// isTimeInWindow, isUserBlockedBySchedule, checkAndLogViolations
```
Keep the shared types (`PersistedRuleInstance`, `RuleUserRow`, `RuleServerRow`,
`RuleEventRow`) either in `index.ts` or a `rules/types.ts` imported by the others.

> **Important:** Many files import `{ ... } from "@/lib/rules"` (API routes, dashboard,
> instrumentation). Moving to a folder with `rules/index.ts` keeps that path working.
> Alternatively, leave `rules.ts` as the barrel that re-exports from sibling files.
> Either is fine; pick one and be consistent. Confirm callers with:
> `grep -rn "from \"@/lib/rules\"" src/`

### `checkAndLogViolations` note
This function is the real complexity. It's an async enforcement loop over sessions
that applies rule logic and writes `rule_events`. When extracting it, it pulls in:
`PlexSession`, `terminateSession` (from `plex.ts`), the discord notification senders,
and the event/assignment helpers. Move it whole first; only consider breaking it into
sub-functions (e.g. one per rule type) as a *second* pass, if at all. Don't combine
"move it" and "restructure it" in one step.

---

## Target 2: `src/lib/plex.ts` (~922 lines)

Plex HTTP client. Internal groups (by line range, re-measure):

- **Types** (~38–243): `PlexStream`, `PlexPart`, `PlexMedia`, `PlexMetadata`,
  `PlexMediaContainer`, `PlexServerConfig`, `PlexSession`, `LibrarySection`,
  `SessionSummary`, etc.
- **Quality profile maps** (~5–37): `VIDEO_QUALITY_PROFILES`, `AUDIO_QUALITY_PROFILES`,
  `VIDEO_RESOLUTION_OVERRIDES`.
- **Core fetch + helpers** (~244–383): `parser` (XML), `toArray`, `resolveServer`,
  `normalizePlexUrl`, `plexFetch`, `decodePlexString`, `formatTitle`.
- **Domain fetchers**: `fetchItemMetadata`, `fetchMetadataChildren`, `fetchSessions`
  (~433–724, the big one — session parsing/normalization), `fetchLibraries`,
  `getDashboardSnapshot`, `fetchPlexUsers`, `terminateSession`.

### Proposed split
```
src/lib/plex/
  index.ts          // re-exports; preserves "@/lib/plex" import path
  plex-types.ts     // all exported interfaces/types + the quality-profile maps
  plex-client.ts    // resolveServer, normalizePlexUrl, plexFetch, decodePlexString, parser, toArray
  plex-sessions.ts  // fetchSessions + session/stream parsing + SessionSummary helpers
  plex-library.ts   // fetchLibraries, fetchItemMetadata, fetchMetadataChildren, getDashboardSnapshot
  plex-users.ts     // fetchPlexUsers, terminateSession
```
`@/lib/plex` is imported widely (history, cron, rules, routes). Use `plex/index.ts`
as a barrel re-exporting all current public names. Confirm callers:
`grep -rn "from \"@/lib/plex\"" src/`

The session-parsing logic inside `fetchSessions` (~433–724) is the dense part. Move it
to `plex-sessions.ts` intact; do not rewrite the parsing.

---

## Target 3: `src/features/rules/components/settings/RuleModal.tsx` (~929 lines)

A single React client component (`"use client"`) that renders the create/edit form for
*all* rule types plus assignment selection and the webhook picker. This is the most
judgment-heavy split (React, not pure functions).

### Approach
- Each rule `type` (e.g. `max_concurrent_streams`, scheduled-access, paused-stream)
  has its own settings sub-form inside the modal. Extract each into a child component
  under `src/features/rules/components/settings/rule-forms/` (e.g. `ConcurrentStreamsForm.tsx`,
  `ScheduledAccessForm.tsx`). Pass `settings` + an `onChange` callback down.
- Extract the **assignment UI** (user/server multi-select) into its own component.
- Extract the **webhook picker** into its own component.
- `RuleModal.tsx` becomes the shell: open/close, save orchestration, tab/section
  layout, and delegating each section to a child.
- Shared type is already centralized in `src/features/rules/types.ts` — import from
  there; do not redefine.

### Cautions
- Preserve all state, validation, and `onSave` behavior exactly. React state that was
  local to the monolith must be lifted to the shell and passed down (or kept in the
  child if it's purely local). This is the easiest place to accidentally change
  behavior — go section by section and test the modal in the running app after each
  extraction (open create + edit for each rule type, save, confirm payload).
- This file has the most `any` of the UI files; you may tighten types opportunistically
  using `RuleSettings`/`RuleSchedule` from `src/features/rules/types.ts`, but keep that
  secondary to the structural split.

---

## Suggested order & checkpoints

1. `rules.ts` → `rules/` folder. tsc + vitest + dev compile. Commit.
2. `plex.ts` → `plex/` folder. tsc + vitest + dev compile. Commit.
3. `RuleModal.tsx` → shell + child forms. **Manually test the modal in the app** for
   each rule type (create + edit + save). Commit.
4. (Optional) Same treatment for `tautulli/api/route.ts`, `settings/import/page.tsx`,
   `setup/page.tsx` if still oversized.

## Definition of done
- No source file over ~500 lines among the three primary targets.
- `npx tsc --noEmit` shows only the known stale `.next/types/validator.ts` errors.
- `npx vitest run` green.
- Every original import path (`@/lib/rules`, `@/lib/plex`, the RuleModal path) still
  resolves — no call site outside these files needed editing (or only trivial edits).
- Rules modal verified by hand in the running app.

## Also pending (tiny, unrelated follow-up)
`src/lib/user_stats.ts` has 4 remaining `as any` casts (~lines 275–278) on aggregate
query results (period stats with SUM/COUNT). These need small *projection* interfaces
matching the computed SELECT columns — not table-row types. Left undone in #2 because
guessing computed-column shapes is error-prone; do it deliberately by reading the
actual SELECT statements in that file.
