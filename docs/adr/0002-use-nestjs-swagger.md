# 0002: Use NestJS Swagger for service API documentation

Status: Accepted
Date: 2026-09-07
Author: backend implementer

## Context

The Giftcards and Stores services have separate HTTP surfaces and need useful,
locally reachable API documentation without changing business behavior. The
services use NestJS 11 and class-validator, so documentation must reflect the
existing routes, validation inputs, integer-cent units, and pagination contract.

## Decision

We will use the maintained `@nestjs/swagger` 11.x package and configure one
OpenAPI document and Swagger UI per service at `/api/docs`, with JSON at
`/api/docs-json` behind each service's existing `/api` prefix. Docs default to
enabled outside production and are disabled for `NODE_ENV=production` unless
`ENABLE_API_DOCS=true`; `ENABLE_API_DOCS=false` always disables them.

## Alternatives considered

- Hand-written static OpenAPI files: rejected because they can drift from Nest route and DTO metadata.
- A shared combined document: rejected because the services run independently on different ports.
- Unconditional production exposure: rejected because public API metadata and
  operational endpoints should not be exposed without an explicit deployment decision.

## Consequences

DTO and controller decorators make request and response documentation discoverable
and testable, while adding a runtime dependency and a maintenance obligation to
keep annotations aligned with future endpoint changes. Documentation is reachable
in the current development/challenge setup and is not protected by auth; production
requires an explicit environment override and a deployment-level access review.
