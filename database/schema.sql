-- ExamSync Database Schema
-- Last updated: 2026-05 — multi-tenancy (owner_id on root tables)
BEGIN;

-- ============================================================
-- USERS  (central auth entity — must be created first)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users
(
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(120)  NOT NULL,
    password_hash   VARCHAR(255),                  -- NULL for Google OAuth-only accounts
    role            VARCHAR(20)   NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    google_id       VARCHAR(100),                  -- Google OAuth subject ID
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP,
    CONSTRAINT users_email_key     UNIQUE (email),
    CONSTRAINT users_google_id_key UNIQUE (google_id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON public.users (role);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.departments
(
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    code       VARCHAR(20)  NOT NULL,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT departments_code_key UNIQUE (code)
);

-- ============================================================
-- INSTRUCTORS
-- owner_id = the teacher user who owns/manages this instructor record
-- user_id  = set when this instructor IS a registered teacher user
-- ============================================================
CREATE TABLE IF NOT EXISTS public.instructors
(
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(120),
    department_id   INTEGER      NOT NULL,
    is_available    BOOLEAN      DEFAULT TRUE,
    instructor_type VARCHAR(20)  NOT NULL DEFAULT 'faculty' CHECK (instructor_type IN ('faculty', 'assistant')),
    user_id         INTEGER,                        -- links to users table (when instructor is a teacher)
    owner_id        INTEGER,                        -- tenant owner (teacher who manages this record)
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP,
    CONSTRAINT instructors_owner_email_key UNIQUE (owner_id, email)
);

-- ============================================================
-- STUDENTS
-- Student number format: YYYY C E NNN
--   YYYY = enrollment year
--   C    = class_no (1–4)
--   E    = education type (1 = first, 2 = secondary)
--   NNN  = sequence
--   e.g. 202631009 → year 2026, class 3, first education, #9
-- owner_id = the teacher who imported this student
-- ============================================================
CREATE TABLE IF NOT EXISTS public.students
(
    id             SERIAL PRIMARY KEY,
    student_no     VARCHAR(30)  NOT NULL,
    full_name      VARCHAR(120) NOT NULL,
    email          VARCHAR(120),                  -- generated: {student_no}@ogr.edu.tr
    department_id  INTEGER      NOT NULL,
    semester_no    INTEGER,
    class_no       SMALLINT     CHECK (class_no BETWEEN 1 AND 4),
    education_type VARCHAR(20)  CHECK (education_type IN ('first', 'secondary')),
    status         VARCHAR(30)  DEFAULT 'active',
    user_id        INTEGER,                       -- links to users table
    owner_id       INTEGER,                       -- tenant owner (teacher who imported this student)
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT students_student_no_key UNIQUE (student_no),
    CONSTRAINT students_email_key      UNIQUE (email)
);

-- ============================================================
-- COURSES
-- owner_id = the teacher who owns this course
-- ============================================================
CREATE TABLE IF NOT EXISTS public.courses
(
    id                    SERIAL PRIMARY KEY,
    course_code           VARCHAR(30)  NOT NULL,
    course_name           VARCHAR(150) NOT NULL,
    department_id         INTEGER      NOT NULL,
    exam_duration_minutes INTEGER      NOT NULL,
    student_count_cache   INTEGER      DEFAULT 0,
    is_active             BOOLEAN      DEFAULT TRUE,
    owner_id              INTEGER,                -- tenant owner
    created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT courses_owner_course_code_key UNIQUE (owner_id, course_code)
);

-- ============================================================
-- ENROLLMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.enrollments
(
    id                SERIAL PRIMARY KEY,
    student_id        INTEGER     NOT NULL,
    course_id         INTEGER     NOT NULL,
    enrollment_source VARCHAR(50) DEFAULT 'manual',
    created_at        TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_course UNIQUE (student_id, course_id)
);

-- ============================================================
-- EXAM PERIODS
-- owner_id = the teacher who owns this exam period
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exam_periods
(
    id                     SERIAL PRIMARY KEY,
    name                   VARCHAR(100) NOT NULL,
    academic_year          VARCHAR(20)  NOT NULL,
    term                   VARCHAR(30)  NOT NULL,
    exam_type              VARCHAR(30)  NOT NULL,
    start_date             DATE         NOT NULL,
    end_date               DATE         NOT NULL,
    status                 VARCHAR(30)  DEFAULT 'draft',
    schedule_quality_score NUMERIC(5,2),
    schedule_metrics       JSONB,
    last_scheduled_at      TIMESTAMP,
    owner_id               INTEGER,               -- tenant owner
    created_at             TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP
);

-- ============================================================
-- ROOMS
-- owner_id = the teacher who owns this room
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rooms
(
    id         SERIAL PRIMARY KEY,
    room_code  VARCHAR(30)  NOT NULL,
    building   VARCHAR(100),
    capacity   INTEGER      NOT NULL,
    is_active  BOOLEAN      DEFAULT TRUE,
    owner_id   INTEGER,                           -- tenant owner
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT rooms_owner_room_code_key UNIQUE (owner_id, room_code)
);

-- ============================================================
-- TIME SLOTS (child of exam_periods — inherits ownership)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.time_slots
(
    id               SERIAL PRIMARY KEY,
    exam_period_id   INTEGER NOT NULL,
    slot_date        DATE    NOT NULL,
    start_time       TIME    NOT NULL,
    end_time         TIME    NOT NULL,
    duration_minutes INTEGER NOT NULL,
    is_active        BOOLEAN DEFAULT TRUE,
    CONSTRAINT uq_exam_period_slot UNIQUE (exam_period_id, slot_date, start_time, end_time)
);

-- ============================================================
-- EXAMS (child of exam_periods — inherits ownership)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exams
(
    id                    SERIAL PRIMARY KEY,
    course_id             INTEGER     NOT NULL,
    exam_period_id        INTEGER     NOT NULL,
    time_slot_id          INTEGER,
    primary_instructor_id INTEGER,
    status                VARCHAR(30) DEFAULT 'draft',
    notes                 TEXT,
    created_at            TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP,
    CONSTRAINT uq_exam_course_period UNIQUE (course_id, exam_period_id)
);

-- ============================================================
-- EXAM ROOM ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exam_room_assignments
(
    id                       SERIAL PRIMARY KEY,
    exam_id                  INTEGER NOT NULL,
    room_id                  INTEGER NOT NULL,
    assigned_capacity        INTEGER NOT NULL,
    supervisor_instructor_id INTEGER,
    CONSTRAINT uq_exam_room UNIQUE (exam_id, room_id)
);

-- ============================================================
-- COURSE INSTRUCTORS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.course_instructors
(
    id            SERIAL PRIMARY KEY,
    course_id     INTEGER     NOT NULL,
    instructor_id INTEGER     NOT NULL,
    role          VARCHAR(30) DEFAULT 'primary',
    CONSTRAINT uq_course_instructor UNIQUE (course_id, instructor_id)
);

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

-- instructors → departments / users / owner
ALTER TABLE IF EXISTS public.instructors
    ADD CONSTRAINT fk_instructors_department FOREIGN KEY (department_id)
        REFERENCES public.departments (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_instructors_department_id ON public.instructors (department_id);

ALTER TABLE IF EXISTS public.instructors
    ADD CONSTRAINT fk_instructors_user FOREIGN KEY (user_id)
        REFERENCES public.users (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_instructors_user_id ON public.instructors (user_id);

ALTER TABLE IF EXISTS public.instructors
    ADD CONSTRAINT fk_instructors_owner FOREIGN KEY (owner_id)
        REFERENCES public.users (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_instructors_owner_id ON public.instructors (owner_id);

-- students → departments / users / owner
ALTER TABLE IF EXISTS public.students
    ADD CONSTRAINT fk_students_department FOREIGN KEY (department_id)
        REFERENCES public.departments (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_students_department_id ON public.students (department_id);

ALTER TABLE IF EXISTS public.students
    ADD CONSTRAINT fk_students_user FOREIGN KEY (user_id)
        REFERENCES public.users (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students (user_id);

ALTER TABLE IF EXISTS public.students
    ADD CONSTRAINT fk_students_owner FOREIGN KEY (owner_id)
        REFERENCES public.users (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_owner_id   ON public.students (owner_id);
CREATE INDEX IF NOT EXISTS idx_students_class_edu  ON public.students (class_no, education_type);

-- courses → departments / owner
ALTER TABLE IF EXISTS public.courses
    ADD CONSTRAINT fk_courses_department FOREIGN KEY (department_id)
        REFERENCES public.departments (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_courses_department_id ON public.courses (department_id);

ALTER TABLE IF EXISTS public.courses
    ADD CONSTRAINT fk_courses_owner FOREIGN KEY (owner_id)
        REFERENCES public.users (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_courses_owner_id ON public.courses (owner_id);

-- enrollments → students / courses
ALTER TABLE IF EXISTS public.enrollments
    ADD CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id)
        REFERENCES public.students (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON public.enrollments (student_id);

ALTER TABLE IF EXISTS public.enrollments
    ADD CONSTRAINT fk_enrollments_course FOREIGN KEY (course_id)
        REFERENCES public.courses (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON public.enrollments (course_id);

-- exam_periods → owner
ALTER TABLE IF EXISTS public.exam_periods
    ADD CONSTRAINT fk_exam_periods_owner FOREIGN KEY (owner_id)
        REFERENCES public.users (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_exam_periods_owner_id ON public.exam_periods (owner_id);

-- rooms → owner
ALTER TABLE IF EXISTS public.rooms
    ADD CONSTRAINT fk_rooms_owner FOREIGN KEY (owner_id)
        REFERENCES public.users (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_rooms_owner_id ON public.rooms (owner_id);

-- time_slots → exam_periods
ALTER TABLE IF EXISTS public.time_slots
    ADD CONSTRAINT fk_time_slots_exam_period FOREIGN KEY (exam_period_id)
        REFERENCES public.exam_periods (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_time_slots_exam_period_id ON public.time_slots (exam_period_id);

-- exams → courses / exam_periods / time_slots / instructors
ALTER TABLE IF EXISTS public.exams
    ADD CONSTRAINT fk_exams_course FOREIGN KEY (course_id)
        REFERENCES public.courses (id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.exams
    ADD CONSTRAINT fk_exams_exam_period FOREIGN KEY (exam_period_id)
        REFERENCES public.exam_periods (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_exams_exam_period_id ON public.exams (exam_period_id);

ALTER TABLE IF EXISTS public.exams
    ADD CONSTRAINT fk_exams_time_slot FOREIGN KEY (time_slot_id)
        REFERENCES public.time_slots (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_exams_time_slot_id ON public.exams (time_slot_id);

ALTER TABLE IF EXISTS public.exams
    ADD CONSTRAINT fk_exams_primary_instructor FOREIGN KEY (primary_instructor_id)
        REFERENCES public.instructors (id) ON DELETE SET NULL;

-- exam_room_assignments → exams / rooms / instructors
ALTER TABLE IF EXISTS public.exam_room_assignments
    ADD CONSTRAINT fk_exam_room_assignments_exam FOREIGN KEY (exam_id)
        REFERENCES public.exams (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_exam_room_assignments_exam_id ON public.exam_room_assignments (exam_id);

ALTER TABLE IF EXISTS public.exam_room_assignments
    ADD CONSTRAINT fk_exam_room_assignments_room FOREIGN KEY (room_id)
        REFERENCES public.rooms (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_exam_room_assignments_room_id ON public.exam_room_assignments (room_id);

ALTER TABLE IF EXISTS public.exam_room_assignments
    ADD CONSTRAINT fk_exam_room_assignments_supervisor FOREIGN KEY (supervisor_instructor_id)
        REFERENCES public.instructors (id) ON DELETE SET NULL;

-- course_instructors → courses / instructors
ALTER TABLE IF EXISTS public.course_instructors
    ADD CONSTRAINT fk_course_instructors_course FOREIGN KEY (course_id)
        REFERENCES public.courses (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_course_instructors_course_id ON public.course_instructors (course_id);

ALTER TABLE IF EXISTS public.course_instructors
    ADD CONSTRAINT fk_course_instructors_instructor FOREIGN KEY (instructor_id)
        REFERENCES public.instructors (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_course_instructors_instructor_id ON public.course_instructors (instructor_id);

END;
