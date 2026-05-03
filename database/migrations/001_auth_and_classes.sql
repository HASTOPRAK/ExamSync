-- ============================================================
-- Migration 001: Auth System + Class/Education Type for Students
-- ============================================================

BEGIN;

-- ============================================================
-- 1. USERS TABLE (central auth entity)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users
(
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(120) NOT NULL,
    password_hash   VARCHAR(255),                  -- NULL for Google OAuth-only accounts
    role            VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    google_id       VARCHAR(100),                  -- Google OAuth subject ID
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP,
    CONSTRAINT users_email_key    UNIQUE (email),
    CONSTRAINT users_google_id_key UNIQUE (google_id)
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_role   ON public.users (role);

-- ============================================================
-- 2. ADD class_no + education_type TO students
-- ============================================================
ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS class_no        SMALLINT
        CHECK (class_no BETWEEN 1 AND 4),
    ADD COLUMN IF NOT EXISTS education_type  VARCHAR(20)
        CHECK (education_type IN ('first', 'secondary')),
    ADD COLUMN IF NOT EXISTS user_id         INTEGER
        REFERENCES public.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_user_id         ON public.students (user_id);
CREATE INDEX IF NOT EXISTS idx_students_class_edu       ON public.students (class_no, education_type);

-- ============================================================
-- 3. ADD user_id TO instructors
-- ============================================================
ALTER TABLE public.instructors
    ADD COLUMN IF NOT EXISTS user_id INTEGER
        REFERENCES public.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_instructors_user_id ON public.instructors (user_id);

-- ============================================================
-- 4. BACKFILL class_no + education_type FROM student_no
--    Format: YYYY C E NNN
--      YYYY = enrollment year  (chars 1-4)
--      C    = class_no 1-4    (char 5)
--      E    = edu type 1|2    (char 6)  1→first  2→secondary
--      NNN  = sequence        (chars 7-9)
--    Example: 202631009 → class 3, first education
-- ============================================================
UPDATE public.students
SET
    class_no       = CASE
                         WHEN LENGTH(student_no) = 9
                         THEN SUBSTRING(student_no FROM 5 FOR 1)::SMALLINT
                         ELSE NULL
                     END,
    education_type = CASE
                         WHEN LENGTH(student_no) = 9 AND SUBSTRING(student_no FROM 6 FOR 1) = '1' THEN 'first'
                         WHEN LENGTH(student_no) = 9 AND SUBSTRING(student_no FROM 6 FOR 1) = '2' THEN 'secondary'
                         ELSE NULL
                     END
WHERE class_no IS NULL;

COMMIT;
