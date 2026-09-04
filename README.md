# Backend Challenge - NestJS Monorepo

A NestJS monorepo with two main microservices: **Stores** and **Giftcards**.

Even though they share the same underlying database for simplicity, they are two separate microservices.

## Technology Stack

- **NestJS** - Node.js framework
- **Drizzle ORM** - TypeScript ORM for database operations
- **SQLite** - Database (via libsql)
- **class-validator** - Validation
- **class-transformer** - Transformation
- **TypeScript** - Programming language

## Project Structure

```
backend-challenge/
├── apps/
│   ├── giftcards/                 # Giftcards application
│   │   ├── src/
│   │   │   ├── app.module.ts
│   │   │   ├── giftcards/
│   │   │   │   ├── dto/
│   │   │   │   ├── entities/
│   │   │   │   ├── giftcards.controller.ts
│   │   │   │   ├── giftcards.service.ts
│   │   │   │   ├── giftcards.module.ts
│   │   │   │   └── index.ts
│   │   │   └── main.ts
│   │   └── tsconfig.app.json
│   └── stores/                    # Stores application
│       ├── src/
│       │   ├── app.module.ts
│       │   ├── stores/
│       │   │   ├── dto/
│       │   │   ├── entities/
│       │   │   ├── stores.controller.ts
│       │   │   ├── stores.service.ts
│       │   │   ├── stores.module.ts
│       │   │   └── index.ts
│       │   └── main.ts
│       └── tsconfig.app.json
├── libs/
│   └── database/
│       ├── src/
│       │   ├── database.service.ts
│       │   └── index.ts
│       └── tsconfig.lib.json
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md
```

## Features

### Giftcards App
- Create, read, update, and delete giftcards
- Giftcard entity with amount, description, expiration, store, and receiver fields
- REST API endpoints at `/api/giftcards`
- Runs on port 3000

### Stores App
- Create, read, update, and delete stores
- Store entity with id, name, country code, address, and timestamps
- Full CRUD operations with validation
- REST API endpoints at `/api/stores`
- Runs on port 3001

## Prerequisites

- Node.js (v24 or higher) - check the .nvmrc file for the recommended version
- npm

## Installation

1. Install dependencies:
```bash
npm install
```

2. (Optional) Set up your database configuration by creating a `.env` file:
```bash
DATABASE_URL=file:./data/app.db
NODE_ENV=development
```

## Running the Application

```bash
# Development mode - Run both apps in parallel
npm run start:dev

# Development mode - Run individual apps
npm run start:dev:giftcards
npm run start:dev:stores

```

When running both apps in parallel:
- The giftcards application will be available at `http://localhost:3000`
- The stores application will be available at `http://localhost:3001`

## API Endpoints

### Giftcards (Port 3000)
- `GET /api/giftcards` - Get all giftcards (optional ?userEmail query)
- `GET /api/giftcards/:id` - Get giftcard by ID
- `POST /api/giftcards` - Create new giftcard
- `DELETE /api/giftcards/:id` - Delete giftcard

### Stores (Port 3001)
- `GET /api/stores` - Get all stores
- `GET /api/stores/:id` - Get store by ID
- `POST /api/stores` - Create new store
- `PATCH /api/stores/:id` - Update store
- `DELETE /api/stores/:id` - Delete store


## Development

### Testing
The tests are set up to run with Jest. But currently there are no meaningful tests implemented.
Feel free to add tests if you want to.

```bash
# Run tests
npm test

```

## Database Schema

The application uses Drizzle ORM with SQLite to simplify the database operations. The schema includes:

- **giftcards** table: id, amount, description, expiresAt, storeId, receriverEmail, createdAt, updatedAt
- **stores** table: id (UUID), name, countryCode, address, createdAt, updatedAt

## Database Operations

currently there is no migration system. You can see in the database.service.ts how the default tables are created.

# The challenge

## Overall instructions

- allow yourself to get used to the codebase and the project structure.
- read this README.md file carefully.
- do not spend too much time on the challenge. We suggest ~3 hours.
- it's ok if you don't finish all the tasks. We care more about your thought process, your approach and your code.
- please let us know if you have any questions, we're here to help.
- feel free to do/add "bonus" tasks if you want to. Of course do not exceed the ~3 hours.
- there is a testing setup, but currently there are no meaningful tests implemented. Feel free to add tests if you want to or need to.

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

Please refactor the endpoint to support pagination. You're free to choose the pagination strategy as well as the query parameters and response format.

## task 2

- Validate if the store id exists before creating a giftcard.

Currently, it is possible to create a giftcard with a store id that does not exist.

To avoid this, it is good to validate if the store id exists in the Stores service before creating a giftcard.

## task 3

There is a new business requirement: Users should be able to spend a giftcard partially.

### 3.a\) Add a new entity: SpendsLog.

This entity should have the following fields:
- id
- giftcardId
- amount
- createdAt

The SpendsLog entity should be used to log all the spends on a giftcard.

### 3.b\)  Add a new endpoint to the giftcards app to register a spend on a giftcard.

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

The summary should include the total of expired giftcards, the total of active giftcards, and the following breakdown by store:

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

