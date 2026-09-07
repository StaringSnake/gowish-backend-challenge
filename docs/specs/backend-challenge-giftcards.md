# Feature spec: Giftcard pagination, validation, spending, and summary

## Goal

Complete the highest-priority README backend challenge work: make giftcard listing bounded, prevent references to unknown stores, support partial redemption with an auditable spend log and remaining balance, and expose active/expired summary reporting.

## Decisions

- Pagination -> page/limit with `{ data, meta }`, defaults page 1 and limit 20, maximum limit 100; invalid values are rejected (source: user).
- Listing filter/order -> `userEmail` remains supported and is paginated; results are newest first by `createdAt`, then `id` descending (source: user).
- Store validation -> Giftcards calls Stores over HTTP using `STORES_SERVICE_URL`; missing store is 400, upstream unavailable/unexpected failure is 503, and creation is not persisted (source: user, ADR-0001).
- Amounts -> positive integer cents in the API and database; existing decimal values migrate by multiplying by 100 and rounding (source: user, ADR-0001).
- Spending -> positive amount not exceeding current balance; multiple spends are allowed; expired cards cannot be spent; balance check and log insert are transactional (source: user).
- `currentAmount` -> included in every giftcard response, calculated as issued amount minus all spends (source: user).
- Summary -> `GET /api/giftcards/summary` counts expired/active cards globally and by store; `totalAmountCents` is remaining balance; only stores with giftcards appear; empty data yields an empty `byStore` object (source: user).
- Expiration -> a card is expired only when its expiration is before evaluation time; null expiration is active (source: user).
- Schema evolution/testing -> implement only the minimum schema setup needed for spending; cover critical paths and behaviors with focused tests rather than exhaustive coverage (source: user).
- Compatibility -> change existing endpoints in place; no API version is added (source: user).

## Assumptions

- The existing `receriverEmail` spelling remains part of the current public contract unless separately corrected.
- Authorization and resource ownership are out of scope because the challenge defines no authentication or user identity mechanism.
- A standard NestJS/Jest test environment can start or isolate the two services and a test database.

## Out of scope

- Authentication, authorization, rate limiting, and user management.
- Cursor pagination, client-selected sorting, API versioning, idempotency keys, and all-known-store summary entries.
- Changes to unrelated Stores CRUD behavior.
- A full versioned migration system remains out of scope; the minimum schema setup needed for spending is sufficient.

## Acceptance criteria

1. `GET /api/giftcards` accepts optional positive integer `page` and `limit`, applies defaults 1 and 20, rejects invalid values, rejects limits above 100, and returns a bounded `{ data, meta }` response with total/page/limit information.
2. `userEmail` filters the collection before pagination, and results have deterministic newest-first ordering.
3. Creating a giftcard calls the Stores service; an unknown store returns 400, an unavailable/unexpected Stores failure returns 503, and neither failure creates a giftcard.
4. Giftcard and spend amounts are integer cents for the implemented spending flow; the schema setup does not corrupt representative existing data.
5. `SpendsLog` records giftcard id, positive amount, and creation time for every accepted spend.
6. `POST /api/giftcards/:id/spend` returns the updated giftcard, rejects missing cards, expired cards, non-positive amounts, and amounts above current balance, and does not create a log for rejected requests.
7. Concurrent spends cannot reduce a giftcard below zero; accepted spends are applied atomically.
8. Every giftcard response includes `currentAmount`, equal to issued cents minus the sum of its spend logs.
9. `GET /api/giftcards/summary` returns global `totalExpiredCards` and `totalActiveCards`, plus `byStore` entries only for stores with giftcards; each entry contains remaining `totalAmountCents`, `totalExpiredCards`, and `totalActiveCards`.
10. Summary expiration classification treats an `expiresAt` strictly before evaluation time as expired and null `expiresAt` as active; an empty dataset returns `byStore: {}`.

## Impacted areas

- Giftcards list/detail/create/spend HTTP contracts and DTO validation.
- Giftcard summary HTTP contract and aggregation behavior.
- Giftcard and SpendsLog domain/data models, balance calculation, and transaction boundary.
- Stores HTTP client boundary and configuration.
- Minimal SQLite schema changes required by spending.
- Critical-path Jest integration and focused unit test coverage.

## Open risks

- The current database service uses libSQL and startup DDL rather than migrations; a full migration system is deferred.
- Cross-service integration tests need deterministic service startup or a test double without weakening production behavior.
- Changing amounts to cents is a breaking contract for existing clients despite retaining endpoint URLs.
- Summary results depend on a consistent evaluation time across global and per-store aggregation.

SPEC STATUS: approved; summary scope restored; focused critical-path tests retained
