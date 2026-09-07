# Run: Store validation before giftcard creation

Status: completed; issue #3 only

Started: 2026-09-07

## Objective

Validate `storeId` through the Stores HTTP service before persisting a giftcard,
without implementing pagination (#2) or summary reporting (#5).

## Handoffs

- Issue #3 PR created and merged after review and acceptance.

## Decisions

- Use Node 24's built-in `fetch`; no dependency was added.
- Inject `StoresClient` through the Nest module, while the service accepts the
  `StoreValidationClient` boundary for focused unit tests.
- Read `STORES_SERVICE_URL`, defaulting to `http://localhost:3001`, and call
  `/api/stores/:id` with a two-second `AbortController` timeout.
- Map Stores 404 to a stable 400 validation message and all other upstream,
  timeout, malformed, or unexpected failures to a stable 503 message.
- Validate the successful response shape and matching store id before writing.
- General/security findings addressed: redirects use `redirect: "error"`, IDs
  are bounded to 128 characters, and responses are bounded to 16 KiB using
  `Content-Length` plus streaming reads when absent.
- Store URLs are normalized with the `URL` API; configured query/hash values
  are discarded and repeated trailing slashes are removed from the path.
- Final review findings addressed: the ID limit now lives in a neutral
  giftcards constants module; DTO boundary tests prove 128 accepted and 129
  rejected; streamed response tests prove the 16 KiB incremental guard and
  reader cancellation; and timeout coverage stalls response-body consumption.

## Changes

- Added the Stores HTTP validation client and Giftcards service integration.
- Added focused client and persistence-safety tests.

## Verification

- Focused Jest: 23/23 passed.
- Full Jest: 33/33 passed; build and `tsc --noEmit` passed; Prettier check and
  `git diff --check` passed.
- Follow-up focused client tests cover delimiter encoding, redirect rejection,
  timeout abortion, response ID mismatch, oversized responses, and ID bounds.

## Reviews

- General: APPROVE; no findings.
- Security: APPROVE; no findings. Selected for external request/input and
  persistence handling.
- Performance: APPROVE; no findings. Selected for synchronous upstream I/O and
  bounded response-body handling.
- Acceptance: ACCEPT; `npm test` passed 5 suites / 33 tests.

## Risks And Blockers

- The challenge's shared database topology still permits Stores and Giftcards to
  be configured against the same SQLite file, but validation crosses the HTTP
  boundary as required.
- No live two-service integration test was added.
- `STORES_SERVICE_URL` remains an operational configuration boundary, and
  giftcard creation can depend on up to two seconds of Stores latency.

## Outcome

Implemented, reviewed, accepted, and merged; no unrelated worktree changes were
modified.
