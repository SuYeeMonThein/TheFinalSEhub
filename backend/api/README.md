# Backend Course Roster API (CodeNinja_BK/functions)

This backend adds endpoints to persist student roster uploads per course using Supabase.

## Endpoints

- `GET /courses/:courseId/roster` — List roster entries for a course.
- `POST /courses/:courseId/roster` — Upsert roster entries for a course. Body:

```json
{
  "students": [
    {
      "studentId": "STU001",
      "name": "John Doe",
      "email": "john@uni.edu",
      "year": "2024"
    }
  ]
}
```

- `DELETE /courses/:courseId/roster/:studentId` — Remove one roster entry.

All endpoints require Firebase auth (`verifyFirebaseAuth`) and allow `coordinator` or `advisor` roles to modify rosters.

## Supabase schema

Create the `course_roster` table in your Supabase project (SQL editor):

```sql
create table if not exists public.course_roster (
  id bigserial primary key,
  course_id integer not null references public.course(id) on delete cascade,
  student_id text not null,
  name text not null,
  email text not null,
  year text,
  created_at timestamptz default now()
);

create unique index if not exists course_roster_unique on public.course_roster (course_id, student_id);
```

## Environment

Ensure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_STORAGE_BUCKET` are set in `.env`. The service role key is required for upsert/delete.

## Run locally

```powershell
Set-Location "C:\Users\pskps\Downloads\lastone\se-project-hub-main\CodeNinja_BK\functions"
$env:PORT=5002; npm run start
```

Swagger docs: `http://localhost:5002/docs`.
