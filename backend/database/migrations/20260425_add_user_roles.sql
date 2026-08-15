-- Add multi-role support via user_roles table.
-- Keep existing user.role for backward compatibility during rollout.

CREATE TABLE IF NOT EXISTS public.user_roles (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES public."user" (id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_unique_user_role
  ON public.user_roles (user_id, role);

CREATE INDEX IF NOT EXISTS user_roles_user_id_idx
  ON public.user_roles (user_id);

-- Backfill existing single-role users into user_roles.
INSERT INTO public.user_roles (user_id, role)
SELECT id, role
FROM public."user"
ON CONFLICT (user_id, role) DO NOTHING;
