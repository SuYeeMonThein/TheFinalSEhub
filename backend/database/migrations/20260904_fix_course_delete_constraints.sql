-- Preserve projects when their optional course is deleted.

ALTER TABLE public.project
  DROP CONSTRAINT IF EXISTS project_course_id_fkey,
  ADD CONSTRAINT project_course_id_fkey
    FOREIGN KEY (course_id) REFERENCES public.course (id) ON DELETE SET NULL;