# Run: Swagger/OpenAPI documentation

Status: completed
Started: 2026-09-07

## Objective

Resolve general and security review findings for the two NestJS Swagger
documents without changing business endpoint behavior.

## Handoffs

- Reviewer-general: approved with no findings after checking generated schemas,
  production gating, and lockfile visibility.
- Reviewer-security: approved with no findings; production docs remain disabled
  unless explicitly enabled, and `scarfSettings.enabled=false` opts out of
  telemetry.
- Reviewer-performance: skipped because the diff has no data-access, I/O-loop,
  caching, concurrency, serialization, large-payload, or hot-path behavior.

## Decisions

- Keep `@nestjs/swagger` `^11.4.7`, compatible with the Nest 11 service dependencies.
- Use decorated DTO metadata for request/query schemas and reusable controller schema constants for serialized responses.
- Enable docs by default outside production; require `ENABLE_API_DOCS=true` in production and honor `ENABLE_API_DOCS=false` everywhere.
- Opt out of Scarf telemetry narrowly through root `package.json` `scarfSettings.enabled=false`.

## Changes

- Added integer OpenAPI types/formats and bounds for money, spend, page, and limit fields.
- Removed duplicate per-query decorators in favor of one `ListGiftcardsDto` query source.
- Added complete response fields, nullable timestamps/expiration, and PATCH optional-property coverage.
- Expanded integration assertions for generated paths, schemas, unique query names, and gating decisions.
- Updated README and ADR with environment behavior and stable UI/JSON URLs.

## Verification

- Focused Swagger Jest: 2 suites, 4 tests — PASS.
- Full Jest: 10 suites, 69 tests — PASS.
- `npm run build`, `npx --no-install tsc --noEmit`, Prettier check over
  intended files, and `git diff --check` — all PASS (exit 0).
- No artifacts were produced.
- `@scarf/scarf@1.4.0` was inspected: its README and `report.js` document
  `scarfSettings.enabled=false` as the package-level opt-out; no global npm-script
  disable was added.
- Current status preserves `package-lock.json` staged while the other intended
  files remain unstaged; no lockfile backup exists in the repository.

## Reviews

General and security review approved with no findings. Performance review was
skipped for the documented scope reason. Acceptance-verifier: ACCEPT; full
Jest and static criteria verification corroborated the recorded evidence.

## Risks And Blockers

`package-lock.json` is staged while the other intended files remain unstaged;
this journal does not create a commit or pull request.

## Outcome

Ready for commit/PR.
