-- =========================
-- ExamSync Seed Data
-- =========================

-- =========================
-- 1. DEPARTMENT
-- =========================
INSERT INTO departments (name, code)
VALUES ('Computer Engineering', 'CENG');

-- =========================
-- 2. INSTRUCTORS (10)
-- =========================
INSERT INTO instructors (full_name, email, department_id, is_available) VALUES
('Dr. Ayşe Demir',   'ayse.demir@examsync.edu.tr',   1, TRUE),
('Dr. Mehmet Kaya',  'mehmet.kaya@examsync.edu.tr',  1, TRUE),
('Dr. Elif Yılmaz',  'elif.yilmaz@examsync.edu.tr',  1, TRUE),
('Dr. Burak Aydın',  'burak.aydin@examsync.edu.tr',  1, TRUE),
('Dr. Zeynep Arslan','zeynep.arslan@examsync.edu.tr', 1, TRUE),
('Dr. Onur Çelik',   'onur.celik@examsync.edu.tr',   1, TRUE),
('Dr. Selin Koç',    'selin.koc@examsync.edu.tr',    1, TRUE),
('Dr. Emre Şahin',   'emre.sahin@examsync.edu.tr',   1, TRUE),
('Dr. Deniz Uçar',   'deniz.ucar@examsync.edu.tr',   1, TRUE),
('Dr. Hakan Polat',  'hakan.polat@examsync.edu.tr',  1, TRUE);

-- =========================
-- 3. ROOMS (9)
-- =========================
INSERT INTO rooms (room_code, building, capacity, is_active) VALUES
('B101',   'Engineering Block A',  35,  TRUE),
('B102',   'Engineering Block A',  40,  TRUE),
('B103',   'Engineering Block A',  45,  TRUE),
('C201',   'Engineering Block B',  50,  TRUE),
('C202',   'Engineering Block B',  55,  TRUE),
('C203',   'Engineering Block B',  60,  TRUE),
('D301',   'Central Classrooms',   70,  TRUE),
('D302',   'Central Classrooms',   80,  TRUE),
('HALL01', 'Main Hall',           120,  TRUE);

-- =========================
-- 4. COURSES (40 total / 5 per semester)
-- Semester encoded in course code prefix number (CENG1xx = sem 1 … CENG8xx = sem 8)
-- class_no = CEIL(semester / 2)
-- =========================
INSERT INTO courses (course_code, course_name, department_id, exam_duration_minutes, student_count_cache, is_active) VALUES
-- Class 1 / Semester 1
('CENG101', 'Introduction to Programming',    1, 60, 0, TRUE),
('CENG102', 'Calculus I',                     1, 90, 0, TRUE),
('CENG103', 'Physics for Computing',          1, 60, 0, TRUE),
('CENG104', 'Discrete Mathematics',           1, 75, 0, TRUE),
('CENG105', 'Academic Skills for Engineers',  1, 45, 0, TRUE),
-- Class 1 / Semester 2
('CENG201', 'Object-Oriented Programming',    1, 75, 0, TRUE),
('CENG202', 'Calculus II',                    1, 90, 0, TRUE),
('CENG203', 'Digital Logic Design',           1, 75, 0, TRUE),
('CENG204', 'Probability and Statistics',     1, 60, 0, TRUE),
('CENG205', 'Technical Communication',        1, 45, 0, TRUE),
-- Class 2 / Semester 3
('CENG301', 'Data Structures',                1, 75, 0, TRUE),
('CENG302', 'Computer Organization',          1, 75, 0, TRUE),
('CENG303', 'Linear Algebra',                 1, 60, 0, TRUE),
('CENG304', 'Database Systems',               1, 75, 0, TRUE),
('CENG305', 'Numerical Methods',              1, 60, 0, TRUE),
-- Class 2 / Semester 4
('CENG401', 'Algorithms',                     1, 75, 0, TRUE),
('CENG402', 'Operating Systems',              1, 75, 0, TRUE),
('CENG403', 'Microprocessors',                1, 75, 0, TRUE),
('CENG404', 'Software Engineering',           1, 60, 0, TRUE),
('CENG405', 'Signals and Systems',            1, 60, 0, TRUE),
-- Class 3 / Semester 5
('CENG501', 'Computer Networks',              1, 75, 0, TRUE),
('CENG502', 'Theory of Computation',          1, 60, 0, TRUE),
('CENG503', 'Web Development',                1, 60, 0, TRUE),
('CENG504', 'Artificial Intelligence',        1, 75, 0, TRUE),
('CENG505', 'Human Computer Interaction',     1, 45, 0, TRUE),
-- Class 3 / Semester 6
('CENG601', 'Machine Learning',               1, 75, 0, TRUE),
('CENG602', 'Compiler Design',                1, 75, 0, TRUE),
('CENG603', 'Computer Graphics',              1, 60, 0, TRUE),
('CENG604', 'Information Security',           1, 60, 0, TRUE),
('CENG605', 'Simulation and Modeling',        1, 60, 0, TRUE),
-- Class 4 / Semester 7
('CENG701', 'Distributed Systems',            1, 75, 0, TRUE),
('CENG702', 'Mobile Application Development', 1, 60, 0, TRUE),
('CENG703', 'Natural Language Processing',    1, 60, 0, TRUE),
('CENG704', 'Cloud Computing',                1, 60, 0, TRUE),
('CENG705', 'Project Management for Engineers',1,45, 0, TRUE),
-- Class 4 / Semester 8
('CENG801', 'Graduation Project I',           1, 45, 0, TRUE),
('CENG802', 'Graduation Project II',          1, 45, 0, TRUE),
('CENG803', 'Data Mining',                    1, 60, 0, TRUE),
('CENG804', 'Embedded Systems',               1, 75, 0, TRUE),
('CENG805', 'Entrepreneurship in Technology', 1, 45, 0, TRUE);

-- =========================
-- 5. STUDENTS (160 total)
-- 8 groups: 4 classes × 2 education types, 20 students each
-- Student number format: YYYY C E NNN
--   2026  = enrollment year
--   C     = class_no (1-4)
--   E     = education type (1=first, 2=secondary)
--   NNN   = sequence (001-020)
-- Email: {student_no}@ogr.edu.tr
-- semester_no derived: class 1→sem 1-2, class 2→sem 3-4, etc.
--   For seeding we pick the first semester of each class pair.
-- =========================
INSERT INTO students (student_no, full_name, email, department_id, semester_no, class_no, education_type, status)
SELECT
    '2026' || class_no::text || edu_code::text || LPAD(seq::text, 3, '0') AS student_no,
    CASE edu_code
        WHEN 1 THEN 'Student C' || class_no || 'F-' || seq
        ELSE         'Student C' || class_no || 'S-' || seq
    END AS full_name,
    '2026' || class_no::text || edu_code::text || LPAD(seq::text, 3, '0') || '@ogr.edu.tr' AS email,
    1 AS department_id,
    -- first semester of the class pair (1→1, 2→3, 3→5, 4→7)
    (class_no - 1) * 2 + 1 AS semester_no,
    class_no::SMALLINT AS class_no,
    CASE edu_code WHEN 1 THEN 'first' ELSE 'secondary' END AS education_type,
    'active' AS status
FROM
    generate_series(1, 4) AS class_no,
    generate_series(1, 2) AS edu_code,
    generate_series(1, 20) AS seq;

-- =========================
-- 6. ENROLLMENTS
-- Each student is enrolled in all 5 courses of their current semester
-- + a few carryovers for realism
-- Semester → course prefix: sem 1→CENG1xx, sem 2→CENG2xx, …
-- =========================

-- All 5 current-semester courses
INSERT INTO enrollments (student_id, course_id, enrollment_source)
SELECT
    s.id,
    c.id,
    'seed_current'
FROM students s
JOIN courses c
    ON SUBSTRING(c.course_code FROM 5 FOR 1)::INT = s.semester_no;

-- One carryover from previous semester for some students
INSERT INTO enrollments (student_id, course_id, enrollment_source)
SELECT
    s.id,
    c.id,
    'seed_carryover_1'
FROM students s
JOIN courses c
    ON SUBSTRING(c.course_code FROM 5 FOR 1)::INT = s.semester_no - 1
WHERE s.semester_no > 1
  AND (
        (s.id % 3 = 0 AND RIGHT(c.course_code, 2) = '01') OR
        (s.id % 3 = 1 AND RIGHT(c.course_code, 2) = '03')
      );

-- One older carryover for some students
INSERT INTO enrollments (student_id, course_id, enrollment_source)
SELECT
    s.id,
    c.id,
    'seed_carryover_2'
FROM students s
JOIN courses c
    ON SUBSTRING(c.course_code FROM 5 FOR 1)::INT = s.semester_no - 2
WHERE s.semester_no > 2
  AND s.id % 5 = 0
  AND RIGHT(c.course_code, 2) = '02';

-- Some advanced electives for upper-class students
INSERT INTO enrollments (student_id, course_id, enrollment_source)
SELECT
    s.id,
    c.id,
    'seed_elective'
FROM students s
JOIN courses c ON c.course_code IN ('CENG703', 'CENG803', 'CENG604', 'CENG504')
WHERE s.class_no IN (3, 4)
  AND (
        (s.id % 7 = 0 AND c.course_code = 'CENG703') OR
        (s.id % 7 = 1 AND c.course_code = 'CENG803') OR
        (s.id % 7 = 2 AND c.course_code = 'CENG604') OR
        (s.id % 7 = 3 AND c.course_code = 'CENG504')
      )
ON CONFLICT (student_id, course_id) DO NOTHING;

-- =========================
-- 7. UPDATE COURSE STUDENT COUNT CACHE
-- =========================
UPDATE courses SET student_count_cache = 0;

UPDATE courses c
SET student_count_cache = sub.cnt
FROM (
    SELECT course_id, COUNT(*) AS cnt
    FROM enrollments
    GROUP BY course_id
) AS sub
WHERE c.id = sub.course_id;

-- =========================
-- 8. EXAM PERIOD
-- =========================
INSERT INTO exam_periods (name, academic_year, term, exam_type, start_date, end_date, status)
VALUES (
    '2025-2026 Spring Final Exams',
    '2025-2026',
    'Spring',
    'Final',
    DATE '2026-06-01',
    DATE '2026-06-10',
    'draft'
);

-- =========================
-- 9. TIME SLOTS (20 slots — 5 days × 4 slots/day)
-- =========================
INSERT INTO time_slots (exam_period_id, slot_date, start_time, end_time, duration_minutes, is_active)
SELECT
    1,
    d::date,
    t.start_time,
    t.end_time,
    t.duration_minutes,
    TRUE
FROM generate_series(DATE '2026-06-01', DATE '2026-06-05', INTERVAL '1 day') AS d
CROSS JOIN (
    VALUES
        (TIME '09:00', TIME '10:30', 90),
        (TIME '11:00', TIME '12:30', 90),
        (TIME '13:30', TIME '15:00', 90),
        (TIME '15:30', TIME '17:00', 90)
) AS t(start_time, end_time, duration_minutes)
WHERE EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5;

-- =========================
-- 10. COURSE INSTRUCTORS
-- =========================
-- Primary instructor for each course
INSERT INTO course_instructors (course_id, instructor_id, role)
SELECT
    c.id,
    ((c.id - 1) % 10) + 1,
    'primary'
FROM courses c;

-- Assistant instructor for each course
INSERT INTO course_instructors (course_id, instructor_id, role)
SELECT
    c.id,
    (c.id % 10) + 1,
    'assistant'
FROM courses c
WHERE ((c.id - 1) % 10) + 1 <> (c.id % 10) + 1;

-- =========================
-- 11. DRAFT EXAMS FOR ALL COURSES
-- =========================
INSERT INTO exams (course_id, exam_period_id, time_slot_id, primary_instructor_id, status, notes)
SELECT
    c.id,
    1,
    NULL,
    ci.instructor_id,
    'draft',
    'Seeded draft exam record'
FROM courses c
LEFT JOIN course_instructors ci
    ON ci.course_id = c.id AND ci.role = 'primary';
