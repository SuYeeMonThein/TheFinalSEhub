# SE Project Hub

This repository uses a single frontend folder.

## Canonical Frontend

Use `frontend/` as the main frontend application.

- Active app for ongoing development
- Target for all new UI features and bug fixes
- Recommended Render frontend Root Directory: `frontend`

## Deployment Guidance

- Frontend service Root Directory: `frontend`
- Backend API Root Directory: `backend/api`

## Testing Strategy and Debugging //implentation test

### Test Approach

- Unit tests cover pure logic and utilities (e.g., CSV parsing).
- API routes and middleware are verified with request-level tests.
- Focus on correctness, safety regressions, and error handling behaviors.

### Tooling

- Frontend: `vitest` + `@testing-library/react` (see `frontend` package scripts).
- Backend: `jest` + `supertest` (see `backend/api` package scripts).

### Debugging and Error Resolution

- Reproduce issues with minimal inputs and isolate the failing layer (UI, API, or service).
- Add targeted tests that capture the regression before fixing it.
- Prefer deterministic fixes and stronger validation to prevent recurrence.
- Verify fix paths with tests and manual smoke checks (local dev servers).
