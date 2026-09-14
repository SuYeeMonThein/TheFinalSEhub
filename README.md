# SE Project Hub

A platform for managing student capstone/competition project submissions,
advisor and coordinator review, rubric-based grading, and course/roster
administration.

This repository uses a single frontend folder.

## System Overview

SE Project Hub is a two-service web app:

- **`frontend/`** — a React + Vite single-page app that renders a
  role-aware dashboard (student, advisor, coordinator) for browsing,
  submitting, and reviewing projects.
- **`backend/api/`** — a TypeScript Express REST API that sits in front of
  Supabase (Postgres + storage) and verifies Firebase-issued auth tokens.

```
Browser (frontend, Vite dev :8080 / static build)
   │  HTTPS (Firebase ID token in Authorization header)
   ▼
Express API (backend/api, :5001)
   │  Firebase Admin SDK verifies the ID token
   │  Supabase service-role client reads/writes Postgres + storage
   ▼
Supabase (Postgres, Storage)        Firebase Authentication
```

### Roles

The dashboard adapts its navigation by role, defined server-side and
enforced via Firebase custom claims / the `user` table:

- **Student** — My Projects, Submit Project, Rubrics, Account Detail
- **Advisor** — Advisee Projects, Course, Rubric Management, Account Detail
- **Coordinator** — All Projects, User Management, Course Management,
  Student Roster, Rubrics, Reports, Account Detail

### Core domain

- `project` — submissions (capstone / competition / academic / service),
  with `status` (draft, under review, approved, rejected) and `grade`.
- `team_member`, `file`, `link` — per-project team roster, deliverables,
  and reference links (cascade-deleted with their project).
- `project_comment` — reviewer feedback threads on a project.
- `rubric` / `rubric_criterion` / `rubric_level` — grading rubrics used
  for scoring submissions.
- `course`, `course_roster` — course definitions and enrolled students.
- `user` — platform accounts (student / advisor / coordinator), created
  via the coordinator-only `POST /users` endpoint.

## Canonical Frontend

Use `frontend/` as the main frontend application.

- Active app for ongoing development
- Target for all new UI features and bug fixes
- Recommended Render frontend Root Directory: `frontend`

## Tech Stack

| Layer          | Technology                                                        |
| -------------- | ------------------------------------------------------------------ |
| Frontend       | React 18, Vite 5, TypeScript, React Router, TanStack Query, Tailwind CSS, Radix UI / shadcn-style components |
| Backend        | Node.js 20, Express 4, TypeScript, Zod (validation), Helmet, express-rate-limit |
| Auth           | Firebase Authentication (email/password + Google), Firebase Admin SDK for server-side token verification |
| Database       | Supabase (Postgres), accessed via the Supabase service-role client |
| Storage        | Supabase Storage (bucket configurable via `SUPABASE_STORAGE_BUCKET`) |
| Email          | Brevo (via `BREVO_API_KEY`) for transactional/welcome emails |
| Docs           | Swagger UI at `/docs` (backend, non-production only) |
| Testing        | Vitest + Testing Library (frontend), Jest + Supertest (backend) |

## API Surface

Routes registered in `backend/api/src/routes/index.ts`:

| Route         | Purpose                                   |
| ------------- | ------------------------------------------ |
| `/health`     | Liveness check                             |
| `/profile`    | Current authenticated user's profile       |
| `/users`      | Coordinator-controlled user onboarding/list |
| `/projects`   | Project CRUD, submission, review workflow  |
| `/courses`    | Course management and rosters              |
| `/analytics`  | Reporting/analytics dashboard data         |
| `/students`   | Student records                            |
| `/comments`   | Project review comments                    |
| `/rubrics`    | Rubric definitions and criteria            |

## Local Development

### Prerequisites

- Node.js 20+
- A Supabase project (URL, service role key, anon key)
- A Firebase project with Authentication enabled

### Backend (`backend/api`)

```bash
cd backend/api
npm install
cp .env.example .env        # fill in Supabase values
npm run dev                  # http://localhost:5001, Swagger at /docs
```

Firebase Admin credentials (for verifying ID tokens) are picked up from,
in order: `GOOGLE_APPLICATION_CREDENTIALS`, or a service account file at
`backend/api/secrets/firebase-adminsdk.json` (gitignored). Without either,
the server still starts but auth-protected routes will fail.

### Frontend (`frontend`)

```bash
cd frontend
npm install
# create .env.local with VITE_FIREBASE_* keys and VITE_API_BASE_URL
npm run dev                  # http://localhost:8080
```

`VITE_API_BASE_URL` defaults to `http://localhost:5001` when unset. CORS
on the backend defaults to allowing `http://localhost:8080`.

## Deployment Guidance

- Frontend service Root Directory: `frontend`
- Backend API Root Directory: `backend/api`
- Set backend env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_ANON_KEY`, `SUPABASE_STORAGE_BUCKET`, `PORT`,
  `GOOGLE_APPLICATION_CREDENTIALS`) on the host's secret manager — never
  commit real keys.
- Set frontend env vars (`VITE_FIREBASE_*`, `VITE_API_BASE_URL`) at build
  time.

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
