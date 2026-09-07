# Run: Minimal spending schema

Status: Implemented; issue #1 only

Started: 2026-09-07

## Objective

Resolve aggregated review findings without implementing issues #2–#5.

## Handoffs

Reviewer-general requested next; general, security, and performance findings incorporated.

## Decisions

- Serialize all startup DDL/conversion with `BEGIN IMMEDIATE`, 5-second busy timeout, and bounded retries.
- Serialize same-process initializers with a shared promise; database-level timeout/retry covers separate processes.
- Scope same-process initialization promises by database URL so unrelated databases do not queue behind each other.
- Remove settled per-URL queue entries only when the map still references that chain's stored promise.
- Rebuild dependent `spendsLog` inside the same transaction, preserving rows and recreating its FK/index.
- Enforce positive safe integer cents with SQLite `typeof` and range checks.
- Reject invalid legacy values before replacement; use SQLite `ROUND` for conversion.
- Enable Nest global DTO validation for the integer-cent boundary.
- Support fresh strict INTEGER databases and the repository baseline REAL schema; fail fast on unsupported weak INTEGER schemas rather than adding a general migration framework.

## Changes

- Updated startup DDL and legacy conversion in `libs/database/src/database.service.ts`.
- Added/updated giftcard and spends-log schemas, DTO validation, and critical schema tests.

## Verification

- Focused Jest: 7/7 passed, including weak INTEGER fail-fast, concurrent startup, and fractional DTO rejection.
- Full Jest: 10/10 passed twice; build/type-check, formatting, and diff checks passed.

## Reviews

General S1 FK and Drizzle registration: resolved. Security S1 weak INTEGER state: dispositioned as unsupported external state with fail-fast integrity assertion and focused test. Security integer/boundary validation: resolved. Performance S1 contention and queue retention: resolved with per-URL same-process serialization, race-safe settled-entry cleanup, database timeout/retry, and concurrent-init evidence. Whole-table lock accepted as timebox risk.

## Risks And Blockers

No blocker. Startup conversion remains a bounded whole-table replacement because full migration infrastructure is deferred; rollback protects the original tables on failure. Out of scope: pre-existing constructor `path.dirname(DATABASE_URL)` behavior remains a refactoring/bug candidate.

## Outcome

Ready for reviewer-general; unrelated worktree changes remain untouched.
