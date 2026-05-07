-- ============================================================
-- Migration 002: Add instructor_type to instructors
-- Distinguishes course faculty (primary instructors) from
-- exam supervisors (assistant/proctor pool).
-- ============================================================

BEGIN;

ALTER TABLE public.instructors
    ADD COLUMN IF NOT EXISTS instructor_type VARCHAR(20)
        NOT NULL DEFAULT 'faculty'
        CHECK (instructor_type IN ('faculty', 'assistant'));

CREATE INDEX IF NOT EXISTS idx_instructors_type ON public.instructors (instructor_type);

COMMIT;
