-- Assign rubrics to courses (many-to-many)

CREATE TABLE IF NOT EXISTS public.rubric_course (
  rubric_id INT NOT NULL REFERENCES public.rubric (id) ON DELETE CASCADE,
  course_id INT NOT NULL REFERENCES public.course (id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rubric_id, course_id)
);

CREATE INDEX IF NOT EXISTS rubric_course_course_id_idx
  ON public.rubric_course (course_id);
