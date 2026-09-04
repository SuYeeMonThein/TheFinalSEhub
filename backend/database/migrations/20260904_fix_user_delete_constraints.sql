-- Keep user deletion valid for all tables that reference public."user".
-- Assignments are optional; authored comments and team memberships are owned
-- by the account and can be removed with it.

ALTER TABLE public.course
  DROP CONSTRAINT IF EXISTS course_advisor_id_fkey,
  ADD CONSTRAINT course_advisor_id_fkey
    FOREIGN KEY (advisor_id) REFERENCES public."user" (id) ON DELETE SET NULL;

ALTER TABLE public.project
  DROP CONSTRAINT IF EXISTS project_advisor_id_fkey,
  ADD CONSTRAINT project_advisor_id_fkey
    FOREIGN KEY (advisor_id) REFERENCES public."user" (id) ON DELETE SET NULL;

ALTER TABLE public.team_member
  DROP CONSTRAINT IF EXISTS team_member_student_id_fkey,
  ADD CONSTRAINT team_member_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public."user" (id) ON DELETE CASCADE;

ALTER TABLE public.project_comment
  DROP CONSTRAINT IF EXISTS project_comment_user_id_fkey,
  ADD CONSTRAINT project_comment_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public."user" (id) ON DELETE CASCADE;