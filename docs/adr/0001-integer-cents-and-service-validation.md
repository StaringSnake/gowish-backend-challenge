# 0001: Use integer cents and service-owned store validation

Status: Accepted
Date: 2026-09-06
Author: user and planner

## Context
Giftcards currently store decimal currency values in SQLite, while the summary contract names cents and the new spend capability requires exact balance arithmetic. Giftcards and Stores are separate microservices even though they share a database in this challenge. The system also needs to preserve existing data and avoid coupling Giftcards to the Stores persistence schema.

## Decision
We will represent giftcard and spend amounts as positive integer cents, migrate existing decimal values by multiplying by 100 and rounding, and validate `storeId` by calling the Stores HTTP service through an environment-configured base URL. Missing stores return 400; unavailable or unexpected upstream failures return 503 and no giftcard is created.

## Alternatives considered
- Decimal currency values: rejected because floating-point arithmetic risks balance errors.
- Direct shared-database store lookup: rejected because it crosses the service ownership boundary.
- Fresh database or startup-only DDL: rejected because existing data must be preserved safely.

## Consequences
Balance and summary arithmetic become deterministic and service boundaries remain explicit. Existing API consumers must switch amount inputs and outputs from currency units to cents, and a migration system plus upstream failure handling add implementation and operational complexity.
