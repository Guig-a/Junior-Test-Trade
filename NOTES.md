# Implementation Notes

## Assumptions

- The API keeps the provided `ServiceResponse` envelope for every implemented route.
- Shared DTOs in `shared/types.ts` are the public API contract between server and client.
- SQLite files are local development/test artifacts and are intentionally ignored by git; Prisma migrations are committed.
- `Calculation.id` is an internal auto-incrementing integer, exposed as a string to match `SqrtCalculationResponse.id`.

## Async calculation approach

`POST /square-root/calculate` runs the Newton-Raphson calculation in a native Node `worker_threads` worker (`server/src/workers/sqrt-calculation.worker.ts`). This keeps the Express event loop free while preserving the provided `SqrtCalculator` + `NewtonRaphsonAlgorithm` domain flow.

The worker runner supports both development (`tsx`/TypeScript source) and production build output (`dist`). The route only persists a calculation after the worker returns a successful result.

## Numerical precision

The Newton-Raphson implementation intentionally returns a JavaScript `number` directly from the iterative process. Because JavaScript numbers use IEEE-754 floating-point representation, visually exact roots may sometimes be displayed with a tiny residual error, such as `4.000000000000004` for `sqrt(16)`.

I considered normalizing near-integer results after calculation, for example with a helper like `normalizeSqrtResult()`, but did not add that behavior. It would make the UI look cleaner while introducing a correctness risk: values such as `sqrt(15.999999999)` can legitimately be very close to `4`, and an arbitrary epsilon-based rounding layer could silently change the mathematical result. The safer behavior for this exercise is to keep the raw calculated number, let the existing tolerance govern convergence, and document the expected floating-point behavior rather than hiding it.

## Pagination cursor format

`GET /square-root/history?limit=&cursor=` uses cursor-based pagination over `Calculation.id` ordered by newest first. The API fetches `limit + 1` rows to detect whether another page exists. When it does, `nextCursor` is the last returned row's `id`, serialized as a string.

The client treats `nextCursor` as an opaque string and passes it back unchanged.

## Prisma and tests

This fork uses Prisma 7 with SQLite through the `@prisma/adapter-libsql` adapter. The server test script runs `prisma migrate deploy` before Vitest so Supertest integration tests hit a real migrated SQLite database.

## API documentation

OpenAPI is generated in `server/src/openapi/openapi-document.ts` with `@asteasolutions/zod-to-openapi`. The Express app exposes the raw spec at `GET /openapi.json` and Swagger UI at `GET /docs`.

## Rate limit responses

The default `express-rate-limit` response is plain text. The client expects the API to return the `ServiceResponse` envelope, so the rate limiter was customized to return JSON with `429 Too Many Requests`. The client response parser also checks the `Content-Type` before calling `response.json()`, so future non-JSON errors show a useful message instead of crashing with a JSON parse error.

## Improvements with more time

- Add an in-memory or distributed cache for repeated inputs, with clear invalidation behavior.
- Add client-side integration/e2e coverage for form submission, pagination, and clear-history flows.
- Improve pagination UX with page indicators and disabled/loading states per action.
