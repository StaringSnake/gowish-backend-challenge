# Run: Transactional partial giftcard spending

Status: completed; issue #4 only

Started: 2026-09-07

## Objective

Add transactional partial spending and expose remaining balances without implementing issues #2, #3, or #5.

## Handoffs

- Reviewer-general requested next.

## Decisions

- Spend requests use a positive safe integer-cent `amount` body and preserve `receriverEmail`.
- Spending uses Drizzle's libSQL transaction; a conditional giftcard update acquires the write lock and checks issued amount minus the indexed spend-log sum before inserting the log.
- Giftcard responses use one SQL projection with a correlated aggregate subquery, avoiding application-level N+1 queries for list and email-filtered list.
- Missing cards map to 404; expired and insufficient-balance spends map to 400; rejected spends do not insert logs.
- Response methods now return an explicit `GiftcardResponse` type with required `currentAmount`; the post-insert selection has an explicit 500 guard for an impossible missing row.
- Persisted invalid expiration timestamps are rejected as 400. Expiration evaluation time is captured inside the libSQL transaction callback, after transaction acquisition rather than at request entry.
- Nest v11 `ParseIntPipe` uses `/^-?\d+$/` plus `isFinite`, so `1abc` is rejected; no custom parser was added.
- The existing `spendsLog_giftcardId_idx` supports the correlated SUM lookup. Denormalized balance was not approved; SUM cost under the write lock remains an accepted bounded challenge risk.

## Changes

- Added spend DTO, route, service transaction, currentAmount projections, and focused critical-path tests.

## Verification

- Focused Jest: 8/8 passed.
- Full Jest: 18/18 passed; build and `tsc --noEmit` passed; Prettier check and `git diff --check` passed.

## Reviews

- General: APPROVE; no findings.
- Security: APPROVE; selected because the endpoint accepts input and writes monetary/spend data; no findings.
- Performance: APPROVE; selected because transaction/concurrency and aggregate queries are hot-path relevant; no findings.
- Acceptance verifier: ACCEPT; independent `npm test` passed 3 suites/18 tests. Verifier build was permission-blocked; implementer build and `tsc --noEmit` passed.

## Risks And Blockers

- Accepted risks: indexed SUM remains O(spend-history), distributed contention beyond the local topology is deferred, and exhaustive HTTP/DTO testing is deferred.

## Outcome

Accepted for PR creation; no unrelated worktree changes were modified.
