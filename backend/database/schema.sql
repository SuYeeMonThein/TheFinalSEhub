-- Supabase/PostgreSQL schema for the CodeNinja project domain.
-- Defines enum types and tables with foreign-key relationships.

-- Enum type definitions
CREATE TYPE public.user_role AS ENUM ('student', 'advisor', 'coordinator');
CREATE TYPE public.project_keyword AS ENUM ('ai', 'service', 'game', 'health', 'academic', 'other');
CREATE TYPE public.project_type AS ENUM ('academic', 'competition', 'service', 'other');
CREATE TYPE public.semester AS ENUM ('1', '2');
CREATE TYPE public.course_credit AS ENUM ('2', '3');
CREATE TYPE public.project_grade AS ENUM ('A', 'B', 'C');
CREATE TYPE public.project_status AS ENUM ('draft', 'underreview', 'approved', 'reject');

-- Core tables
CREATE TABLE public."user" (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL UNIQUE,
  password VARCHAR NOT NULL,
  role public.user_role NOT NULL DEFAULT 'student'
);

CREATE TABLE public.course (
  id SERIAL PRIMARY KEY,
  course_code VARCHAR NOT NULL,
  semester public.semester NOT NULL,
  year INT NOT NULL,
  credit public.course_credit NOT NULL,
  advisor_id INT REFERENCES public."user" (id)
);

CREATE TABLE public.project (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  keyword public.project_keyword NOT NULL,
  team_name VARCHAR,
  start_date DATE,
  end_date DATE,
  feedback_advisor TEXT,
  feedback_coordinator TEXT,
  comment_student TEXT,
  comment_advisor TEXT,
  project_type public.project_type NOT NULL DEFAULT 'academic',
  description TEXT,
  competition_name VARCHAR,
  semester public.semester NOT NULL,
  year INT NOT NULL,
  advisor_id INT REFERENCES public."user" (id),
  course_id INT REFERENCES public.course (id),
  grade public.project_grade,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status public.project_status NOT NULL DEFAULT 'draft'
);

CREATE UNIQUE INDEX project_name_year_semester_idx
  ON public.project (name, year, semester);

CREATE TABLE public.team_member (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES public."user" (id),
  project_id INT NOT NULL REFERENCES public.project (id)
);

CREATE UNIQUE INDEX team_member_unique_student_project
  ON public.team_member (student_id, project_id);

CREATE TABLE public.file (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES public.project (id) ON DELETE CASCADE,
  file_link VARCHAR NOT NULL
);

CREATE TABLE public.link (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES public.project (id) ON DELETE CASCADE,
  link VARCHAR NOT NULL
);

-- Course roster table for uploading and managing enrolled students per course
CREATE TABLE public.course_roster (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES public.course (id) ON DELETE CASCADE,
  student_id VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  year VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure no duplicates for the same student within the same course
CREATE UNIQUE INDEX course_roster_unique_course_student
  ON public.course_roster (course_id, student_id);

-- Helpful index for common lookups
CREATE INDEX course_roster_course_id_idx
  ON public.course_roster (course_id);
