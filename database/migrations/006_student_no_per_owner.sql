-- ============================================================
-- Migration 006: Scope student_no and email uniqueness to owner_id
--
-- The live DB already has these constraints (added in 001).
-- This migration is a no-op for existing installs and a
-- safety net for fresh installs running from schema.sql directly.
--
-- Root cause fixed here: service code used ON CONFLICT (student_no)
-- but the constraint is (owner_id, student_no). Students and
-- enrollments were silently skipped / throwing errors.
-- ============================================================

BEGIN;

-- Drop old global constraints if they somehow still exist
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_student_no_key;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_email_key;

-- Add per-owner constraints if they don't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_owner_student_no_key'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_owner_student_no_key UNIQUE (owner_id, student_no);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_owner_email_key'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_owner_email_key UNIQUE (owner_id, email);
  END IF;
END $$;

COMMIT;
