-- Add project comments table for advisor-student communication
CREATE TABLE IF NOT EXISTS public.project_comment (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES public.project (id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES public."user" (id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS project_comment_project_id_idx ON public.project_comment (project_id);
CREATE INDEX IF NOT EXISTS project_comment_created_at_idx ON public.project_comment (created_at DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE public.project_comment ENABLE ROW LEVEL SECURITY;
