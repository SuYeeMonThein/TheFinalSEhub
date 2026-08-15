-- Migration: Add course_roster table and indexes
CREATE TABLE IF NOT EXISTS public.course_roster (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES public.course (id) ON DELETE CASCADE,
  student_id VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  year VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS course_roster_unique_course_student
  ON public.course_roster (course_id, student_id);

CREATE INDEX IF NOT EXISTS course_roster_course_id_idx
  ON public.course_roster (course_id);
