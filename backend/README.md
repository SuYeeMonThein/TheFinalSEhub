# CodeNinja Backend

TypeScript Express backend scaffold that you can host on any Node-friendly platform (Render, Railway, Fly.io, etc.). Supabase handles database access and object storage, while Firebase Authentication (free Spark tier) issues ID tokens for email/password and Google SSO flows.

## Features

- **Express API server**: Lightweight REST surface ready to run on any Node.js host or container.
- **Firebase Authentication**: Middleware for verifying ID tokens issued via email/password or Google sign-in providers.
- **Supabase integration**: Pre-configured Supabase client for database access using the service role key.
- **Supabase Storage helpers**: Server-side helpers wired to Supabase buckets for uploads/downloads.
- **TypeScript + Jest**: Strong typing with ready-to-run unit tests via `ts-jest` and `supertest`.
- **Coordinator-controlled user onboarding**: POST `/users` endpoint allowing coordinators to add new platform users.
- **User management queries**: Coordinators can fetch all users or filter by email via GET `/users`.
- **Interactive API docs**: Swagger UI available at `/docs` with auto-generated OpenAPI schema.

## Prerequisites

- Node.js 18 or newer (`npm` CLI required)
- A Firebase project with Authentication enabled (Spark/free tier is sufficient)
- A Supabase project with the `profiles` table (or adjust the example route)

## Setup

1. Install dependencies:
   ```bash
   npm run setup
   ```
2. Copy the sample environment file and populate the secrets:
   ```bash
   cp functions/.env.example functions/.env
   ```
3. Provide Firebase Admin credentials (service account json) for local scripts:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=</path/to/service-account.json>
   ```
4. (Optional) Create a Supabase storage bucket (defaults to `files`):
  ```bash
  npm run storage:create -- files
  ```

## Local Development

- **Standalone Express server**:
  ```bash
  npm run start
  ```
- Visit Swagger UI while the server is running: http://localhost:5001/docs

## Testing & Linting

- Run unit tests:
  ```bash
  npm test
  ```
- Lint the codebase:
  ```bash
  npm run lint
  ```

## Deployment

Use any Node-aware host. Common approaches:

1. **Render/Railway/Fly.io**
  - Build command: `npm run build`
  - Start command: `npm run start`
  - Set environment variables from `functions/.env` (and `GOOGLE_APPLICATION_CREDENTIALS` for Firebase Admin).
2. **Docker**
  - Multi-stage build: install dependencies, run `npm run build`, then launch with `npm run start`.
  - Deploy the container to your preferred platform.

## Project Structure

```
functions/
  ├── package.json      # Functions workspace dependencies & scripts
  ├── src/
  │   ├── app.ts        # Express application factory
  │   ├── server.ts     # Local development server bootstrap
  │   ├── config/       # Firebase & environment helpers
  │   ├── middleware/   # Auth middleware
  │   ├── routes/       # Express route modules (health, profile, ...)
  │   └── services/     # Supabase and storage helpers
  └── __tests__         # Jest test suites (under routes for now)
```

## Authentication Notes

- Configure Firebase Authentication providers (email/password and Google) in the Firebase console before deploying.
- Issue ID tokens on the client or via callable functions; the provided middleware expects an `Authorization: Bearer <token>` header.
- Assign coordinator privileges by setting a custom claim on the user:
  ```bash
  npm run set:coordinator -- <firebase-uid> [role]
  ```
  The optional `role` defaults to `coordinator`. Requires `GOOGLE_APPLICATION_CREDENTIALS` or other Firebase Admin credentials.

## Supabase Notes

- Store the Supabase service role key securely using your hosting provider's secret manager (Render/Railway environment variables, Docker secrets, etc.).
- The sample `/profile` route assumes a `profiles` table keyed by Firebase UID. Adjust the table name or selection logic to match your schema.
- Create Supabase Storage buckets as needed (`supabase.storage.createBucket`) and reference them via the helper in `functions/src/services/storage.ts`.
- Passwords are hashed with bcrypt before insert via the coordinator-only `/users` endpoint. Replace the hashing parameters if you need stronger policies.

## Next Steps

- Connect additional domain-specific routes and data models.
- Add integration or contract tests targeting your chosen deployment environment.
- Configure CI (GitHub Actions) for linting and testing on pull requests.
