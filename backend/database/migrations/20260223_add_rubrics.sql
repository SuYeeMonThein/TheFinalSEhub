-- Add rubric tables for coordinator-managed evaluation rubrics

-- Rubric: top-level evaluation rubric
CREATE TABLE IF NOT EXISTS public.rubric (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  project_types TEXT[] NOT NULL DEFAULT '{}',
  max_points INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rubric criterion: one criterion row per rubric
CREATE TABLE IF NOT EXISTS public.rubric_criterion (
  id SERIAL PRIMARY KEY,
  rubric_id INT NOT NULL REFERENCES public.rubric (id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT,
  plo_ids TEXT[] NOT NULL DEFAULT '{}',
  weight INT NOT NULL DEFAULT 10,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS rubric_criterion_rubric_id_idx
  ON public.rubric_criterion (rubric_id);

-- Rubric level: performance levels within each criterion
CREATE TABLE IF NOT EXISTS public.rubric_level (
  id SERIAL PRIMARY KEY,
  criterion_id INT NOT NULL REFERENCES public.rubric_criterion (id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT,
  points INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS rubric_level_criterion_id_idx
  ON public.rubric_level (criterion_id);
