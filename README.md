# Backend Challenge - NestJS Monorepo

This NestJS monorepo contains separate Giftcards and Stores services. They may
share a SQLite database for this challenge, but store validation crosses the
Stores HTTP service boundary.

## Prerequisites and configuration

- Node.js v24 or higher and npm.
- Install dependencies with `npm install`.
- `DATABASE_URL` selects the libSQL/SQLite database (default:
  `file:./data/app.db`).
- `STORES_SERVICE_URL` is optional and defaults to `http://localhost:3001`.
  Giftcards uses it to validate stores through `GET /api/stores/:id`.

Run both services with `npm run start:dev`; Giftcards listens on port 3000 and
Stores on port 3001. Individual commands are `npm run start:dev:giftcards` and
`npm run start:dev:stores`.

## API

All routes use the `/api` prefix. Monetary amounts are positive safe integer
cents, not decimal currency units. Giftcard responses include the computed
`currentAmount` (issued amount minus recorded spends).

### Giftcards (`http://localhost:3000`)

- `GET /api/giftcards?page=1&limit=20&userEmail=...` returns newest first with
  deterministic `createdAt`/`id` ordering. `page` defaults to 1, `limit` to 20,
  and `limit` is capped at 100; `userEmail` is optional. The response is:
  ```json
  {
    "data": [
      { "id": 1, "amount": 5000, "currentAmount": 3500, "storeId": "store-1" }
    ],
    "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
  }
  ```
- `POST /api/giftcards` creates a giftcard. Its `storeId` is checked through
  Stores before writing: an unknown store returns 400 and an unavailable or
  invalid upstream returns 503; neither writes a giftcard.
- `GET /api/giftcards/:id` returns one giftcard, including `currentAmount`.
- `POST /api/giftcards/:id/spend` accepts `{ "amount": 1500 }` (positive
  integer cents). It returns the updated giftcard. Missing cards return 404;
  invalid amounts, expired cards, and spends over the current balance return
  400, and rejected spends are not logged.
- `GET /api/giftcards/summary` returns `totalExpiredCards`,
  `totalActiveCards`, and `byStore` entries with `totalExpiredCards`,
  `totalActiveCards`, and `totalAmountCents` (the remaining total balance for
  that store, after spends).
- `DELETE /api/giftcards/:id` deletes a giftcard.

### Stores (`http://localhost:3001`)

Stores provide CRUD endpoints: `GET /api/stores`, `GET /api/stores/:id`,
`POST /api/stores`, `PATCH /api/stores/:id`, and `DELETE /api/stores/:id`.

## Database

Drizzle ORM uses SQLite/libSQL. The schema includes `giftcards`, `stores`, and
`spendsLog`; giftcard and spend amounts are positive integer cents, and spend
records cascade when their giftcard is deleted. On startup, the service creates
the schema and can convert the legacy giftcard `REAL` amount column to cents
when the existing data is valid. This is startup schema initialization and a
limited conversion, not a full migration framework; production schema changes
still require an explicit migration process.

## Testing

Meaningful Jest tests cover critical paths, but the suite is not exhaustive.

```bash
# Full Jest suite
npm test

# Live two-service integration suite
npx jest apps/giftcards/src/giftcards/live.integration.spec.ts --runInBand
```

The live integration test boots both Nest services on ephemeral ports with a
shared temporary SQLite database. It covers a valid giftcard/spend journey,
unknown-store rejection without a write, and Stores-service unavailability
without a write. Build/typecheck and formatting checks are also part of the
repository verification workflow.

# The challenge

## Overall instructions

- allow yourself to get used to the codebase and the project structure.
- read this README.md file carefully.
- do not spend too much time on the challenge. We suggest ~3 hours.
- it's ok if you don't finish all the tasks. We care more about your thought
  process, your approach and your code.
- please let us know if you have any questions, we're here to help.
- feel free to do/add "bonus" tasks if you want to. Of course do not exceed the ~3 hours.
- there is a testing setup, but currently there are no meaningful tests
  implemented. Feel free to add tests if you want to or need to.

## Task 1

- Add pagination to the giftcards app.
  Currently, the `GET /api/giftcards` endpoint returns all giftcards:

```
[
    {
        "id": 1,
        "amount": 120.3,
        "description": "Gift card for John Dois",
        "storeId": "1234567890",
        "receriverEmail": "john.dois@example.com",
        "expiresAt": "2025-07-01",
        "createdAt": "2025-06-24T13:21:41.413Z",
        "updatedAt": "2025-06-24T13:21:41.413Z"
    },
    {
        "id": 2,
        "amount": 50,
        "description": "Gift card for Gug",
        "storeId": "otherId",
        "receriverEmail": "john.gug@example.com",
        "expiresAt": "2025-07-01",
        "createdAt": "2025-06-24T14:46:28.004Z",
        "updatedAt": "2025-06-24T14:46:28.004Z"
    },
    {
        "id": 3,
        "amount": 85,
        "description": "Gift card for Ferrari",
        "storeId": "otherId",
        "receriverEmail": "ferrari.gug@example.com",
        "expiresAt": "2025-07-01",
        "createdAt": "2025-06-24T14:46:50.551Z",
        "updatedAt": "2025-06-24T14:46:50.551Z"
    },
    ...
]
```

Please refactor the endpoint to support pagination. You're free to choose the
pagination strategy as well as the query parameters and response format.

## task 2

- Validate if the store id exists before creating a giftcard.

Currently, it is possible to create a giftcard with a store id that does not exist.

To avoid this, it is good to validate if the store id exists in the Stores
service before creating a giftcard.

## task 3

There is a new business requirement: Users should be able to spend a giftcard partially.

### 3.a\) Add a new entity: SpendsLog.

This entity should have the following fields:

- id
- giftcardId
- amount
- createdAt

The SpendsLog entity should be used to log all the spends on a giftcard.

### 3.b\) Add a new endpoint to the giftcards app to register a spend on a giftcard.

The endpoint should be at `/api/giftcards/:id/spend`

The endpoint should register a spend on the giftcard.

The endpoint should return the updated giftcard.

The endpoint should perform any necessary validation and business logic.

### 3.c\) Add a new computed field to the giftcard entity: `currentAmount`.

The current amount should be the Amount of the giftcard minus the sum of all the spends on the giftcard.

## task 4

- add a Summary endpoint to the giftcards app.

The endpoint should be at `/api/giftcards/summary`

The endpoint should return a summary of the giftcards.

The summary should include the total of expired giftcards, the total of active
giftcards, and the following breakdown by store:

- total amount
- total of expired giftcards
- total of active giftcards

example response:

```json
{
  "totalExpiredCards": 10,
  "totalActiveCards": 90,
  "byStore": {
    "store1": {
      "totalAmountCents": 330050,
      "totalExpiredCards": 2,
      "totalActiveCards": 50
    },
    "store2": {
      "totalAmountCents": 200050,
      "totalExpiredCards": 8,
      "totalActiveCards": 40
    }
  }
}
```
