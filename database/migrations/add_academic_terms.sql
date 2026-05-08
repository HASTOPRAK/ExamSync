-- Migration: add academic_terms table
-- Run once against the live database.
--
-- Only the first and last day of classes are stored.
-- semester_start is expected to be a Monday; semester_end a Friday.
-- Exam dates are calculated at runtime (never persisted):
--   Midterm start  = semester_start + 56 days   (week 8 Monday)
--   Midterm end    = semester_start + 67 days   (2 weeks of midterms, Friday)
--   Final start    = semester_end   +  3 days   (Monday after last class Friday)
--   Final end      = semester_end   + 14 days   (2 weeks of finals, Friday)
--   Makeup start   = semester_end   + 17 days   (Monday after finals)
--   Makeup end     = semester_end   + 21 days   (1 week of makeups, Friday)

CREATE TABLE IF NOT EXISTS public.academic_terms
(
    id             SERIAL PRIMARY KEY,
    owner_id       INTEGER      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    academic_year  VARCHAR(20)  NOT NULL,
    term           VARCHAR(50)  NOT NULL,
    semester_start DATE         NOT NULL,  -- first day of classes (a Monday)
    semester_end   DATE         NOT NULL,  -- last day of classes (a Friday)
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP,
    CONSTRAINT uq_academic_term UNIQUE (owner_id, academic_year, term)
);

CREATE INDEX IF NOT EXISTS idx_academic_terms_owner_id ON public.academic_terms (owner_id);
