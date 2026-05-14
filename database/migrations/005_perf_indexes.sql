-- Migration 005: add missing indexes on exams for course_id and primary_instructor_id
-- These columns are used in JOINs and WHERE clauses but had no index.

CREATE INDEX IF NOT EXISTS idx_exams_course_id             ON public.exams (course_id);
CREATE INDEX IF NOT EXISTS idx_exams_primary_instructor_id ON public.exams (primary_instructor_id);
