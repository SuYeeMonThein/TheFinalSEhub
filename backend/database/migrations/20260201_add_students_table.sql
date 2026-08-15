-- Students table for CSV bulk upload and email invitations
-- This table stores students who have been invited to the platform

CREATE TABLE IF NOT EXISTS public.students (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL UNIQUE,
  roll_number VARCHAR NOT NULL,
  year VARCHAR,
  department VARCHAR,
  section VARCHAR,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for common lookups
CREATE INDEX IF NOT EXISTS students_email_idx ON public.students (email);
CREATE INDEX IF NOT EXISTS students_roll_number_idx ON public.students (roll_number);
CREATE INDEX IF NOT EXISTS students_department_idx ON public.students (department);
