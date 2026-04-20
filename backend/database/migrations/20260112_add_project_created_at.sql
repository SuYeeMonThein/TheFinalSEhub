-- Migration: Add created_at column to project table for analytics timelines
ALTER TABLE public.project
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
