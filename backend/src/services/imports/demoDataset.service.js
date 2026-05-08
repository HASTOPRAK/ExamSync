import pool from "../../config/db.js";

const FIRST_NAMES = [
  "Ahmet", "Mehmet", "Ayşe", "Fatma", "Ali", "Zeynep",
  "Mustafa", "Elif", "Can", "Deniz", "Merve", "Emre",
  "Yusuf", "Ece", "Berk", "Seda", "Kerem", "Selin", "Oğuz", "Ceren",
];

const LAST_NAMES = [
  "Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Yıldız",
  "Aydın", "Arslan", "Doğan", "Kılıç", "Koç", "Aslan",
  "Öztürk", "Çetin", "Kurt", "Özdemir", "Tekin", "Polat", "Erdoğan", "Avcı",
];

const COURSE_NAME_PARTS = [
  "Algorithms", "Programming", "Systems", "Databases", "Networks",
  "AI", "Security", "Mathematics", "Architecture", "Software",
  "Web", "Mobile", "Cloud", "Data", "Machine Learning",
  "Operating Systems", "Discrete Structures", "Computer Graphics", "Theory", "Simulation",
];

function buildRandomCourseName(index) {
  const partA = randomItem(COURSE_NAME_PARTS);
  const partB = randomItem(COURSE_NAME_PARTS);
  if (partA === partB) return `Special Topics ${index}`;
  return `${partA} and ${partB}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(items) {
  return items[randomInt(0, items.length - 1)];
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildRandomFullName() {
  return `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function refreshStudentCountCache(client) {
  await client.query(`
    UPDATE courses c
    SET student_count_cache = counts.student_count
    FROM (
      SELECT course_id, COUNT(*)::int AS student_count
      FROM enrollments
      GROUP BY course_id
    ) counts
    WHERE counts.course_id = c.id
  `);

  await client.query(`
    UPDATE courses
    SET student_count_cache = 0
    WHERE id NOT IN (SELECT DISTINCT course_id FROM enrollments)
  `);
}

async function generateDemoCourses({
  courseCount = 20,
  courseCodePrefix = "TST",
  startNumber = 101,
  minDuration = 60,
  maxDuration = 90,
  ownerId,
} = {}) {
  if (!ownerId) return { success: false, message: "ownerId is required" };
  if (courseCount < 1) return { success: false, message: "courseCount must be at least 1" };
  if (minDuration > maxDuration) return { success: false, message: "minDuration cannot be greater than maxDuration" };

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const createdCourses = [];

    for (let i = 0; i < courseCount; i += 1) {
      const courseNumber = startNumber + i;
      const courseCode = `${courseCodePrefix}${courseNumber}`;
      const courseName = buildRandomCourseName(courseNumber);
      const examDurationMinutes = randomInt(minDuration, maxDuration);

      const result = await client.query(
        `INSERT INTO courses (course_code, course_name, department_id, exam_duration_minutes, owner_id)
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT (owner_id, course_code) DO NOTHING
         RETURNING id, course_code, course_name, exam_duration_minutes`,
        [courseCode, courseName, examDurationMinutes, ownerId],
      );

      if (result.rowCount > 0) {
        createdCourses.push(result.rows[0]);
      }
    }

    await client.query("COMMIT");

    return {
      success: true,
      message: "Demo courses generated successfully",
      data: {
        requestedCourseCount: courseCount,
        createdCourseCount: createdCourses.length,
        skippedCourseCount: courseCount - createdCourses.length,
        parameters: { courseCodePrefix, startNumber, minDuration, maxDuration },
        preview: createdCourses.slice(0, 10),
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function generateDemoDataset({
  studentCount = 300,
  minCoursesPerStudent = 4,
  maxCoursesPerStudent = 6,
  studentNoPrefix = "2026",
  courseCodePrefix = "",
  courseFilterMode = "all",
  ownerId,
} = {}) {
  if (!ownerId) return { success: false, message: "ownerId is required" };
  if (studentCount < 1) return { success: false, message: "studentCount must be at least 1" };
  if (minCoursesPerStudent < 1 || maxCoursesPerStudent < 1) {
    return { success: false, message: "Course count per student must be at least 1" };
  }
  if (minCoursesPerStudent > maxCoursesPerStudent) {
    return { success: false, message: "minCoursesPerStudent cannot be greater than maxCoursesPerStudent" };
  }

  const allowedFilterModes = ["all", "include", "exclude"];
  if (!allowedFilterModes.includes(courseFilterMode)) {
    return { success: false, message: `courseFilterMode must be one of: ${allowedFilterModes.join(", ")}` };
  }
  if ((courseFilterMode === "include" || courseFilterMode === "exclude") && !courseCodePrefix) {
    return { success: false, message: "courseCodePrefix is required when courseFilterMode is include or exclude" };
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let coursesQuery = `SELECT id, course_code FROM courses WHERE owner_id = $1`;
    const queryParams = [ownerId];

    if (courseFilterMode === "include") {
      queryParams.push(`${courseCodePrefix}%`);
      coursesQuery += ` AND course_code LIKE $2`;
    } else if (courseFilterMode === "exclude") {
      queryParams.push(`${courseCodePrefix}%`);
      coursesQuery += ` AND course_code NOT LIKE $2`;
    }

    coursesQuery += ` ORDER BY course_code ASC`;

    const coursesResult = await client.query(coursesQuery, queryParams);
    const courses = coursesResult.rows;

    if (courses.length < maxCoursesPerStudent) {
      await client.query("ROLLBACK");
      return {
        success: false,
        message: `Not enough courses in database. Need at least ${maxCoursesPerStudent}, found ${courses.length}.`,
      };
    }

    const existingStudentsResult = await client.query(
      `SELECT student_no FROM students WHERE student_no LIKE $1 AND owner_id = $2 ORDER BY student_no DESC LIMIT 1`,
      [`${studentNoPrefix}%`, ownerId],
    );

    let nextSequence = 1;
    if (existingStudentsResult.rows.length > 0) {
      const lastStudentNo = existingStudentsResult.rows[0].student_no;
      const suffix = lastStudentNo.slice(studentNoPrefix.length);
      const parsed = Number.parseInt(suffix, 10);
      if (!Number.isNaN(parsed)) {
        nextSequence = parsed + 1;
      }
    }

    const coursePools = chunkArray(courses, Math.max(6, Math.ceil(courses.length / 4)));
    const createdStudents = [];
    let insertedEnrollments = 0;

    for (let i = 0; i < studentCount; i += 1) {
      const studentNo = `${studentNoPrefix}${String(nextSequence + i).padStart(4, "0")}`;
      const fullName = buildRandomFullName();

      const studentInsertResult = await client.query(
        `INSERT INTO students (student_no, full_name, department_id, owner_id)
         VALUES ($1, $2, 1, $3)
         RETURNING id, student_no, full_name`,
        [studentNo, fullName, ownerId],
      );

      const student = studentInsertResult.rows[0];
      createdStudents.push(student);

      const targetCourseCount = randomInt(minCoursesPerStudent, maxCoursesPerStudent);
      const primaryPool = randomItem(coursePools);
      const secondaryPool = randomItem(coursePools);

      const primaryCourses = shuffle(primaryPool).slice(
        0,
        Math.min(primaryPool.length, Math.max(2, targetCourseCount - 1)),
      );
      const secondaryCourses = shuffle(secondaryPool).slice(
        0,
        Math.max(1, targetCourseCount - primaryCourses.length),
      );

      const selectedCoursesMap = new Map();
      for (const course of [...primaryCourses, ...secondaryCourses]) {
        selectedCoursesMap.set(course.id, course);
      }

      if (selectedCoursesMap.size < targetCourseCount) {
        const remainingCourses = shuffle(courses);
        for (const course of remainingCourses) {
          selectedCoursesMap.set(course.id, course);
          if (selectedCoursesMap.size >= targetCourseCount) break;
        }
      }

      for (const course of selectedCoursesMap.values()) {
        const enrollmentInsertResult = await client.query(
          `INSERT INTO enrollments (student_id, course_id, enrollment_source)
           VALUES ($1, $2, 'demo_generator')
           ON CONFLICT (student_id, course_id) DO NOTHING`,
          [student.id, course.id],
        );
        insertedEnrollments += enrollmentInsertResult.rowCount;
      }
    }

    await refreshStudentCountCache(client);
    await client.query("COMMIT");

    return {
      success: true,
      message: "Demo dataset generated successfully",
      data: {
        createdStudents: createdStudents.length,
        insertedEnrollments,
        usedCourses: courses.length,
        parameters: {
          studentCount,
          minCoursesPerStudent,
          maxCoursesPerStudent,
          studentNoPrefix,
          courseCodePrefix,
          courseFilterMode,
        },
        preview: createdStudents.slice(0, 10),
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function clearGeneratedDataset({ studentNoPrefix = "2026", ownerId } = {}) {
  if (!ownerId) return { success: false, message: "ownerId is required" };

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const deleteEnrollments = await client.query(
      `DELETE FROM enrollments
       WHERE enrollment_source = 'demo_generator'
         AND student_id IN (SELECT id FROM students WHERE owner_id = $1)
       RETURNING id`,
      [ownerId],
    );

    const deleteStudents = await client.query(
      `DELETE FROM students WHERE student_no LIKE $1 AND owner_id = $2 RETURNING id`,
      [`${studentNoPrefix}%`, ownerId],
    );

    await refreshStudentCountCache(client);
    await client.query("COMMIT");

    return {
      success: true,
      message: "Generated dataset cleared",
      data: {
        deletedEnrollments: deleteEnrollments.rowCount,
        deletedStudents: deleteStudents.rowCount,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function clearGeneratedCourses({ courseCodePrefix = "TST", ownerId } = {}) {
  if (!ownerId) return { success: false, message: "ownerId is required" };

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const generatedCoursesResult = await client.query(
      `SELECT id FROM courses WHERE course_code LIKE $1 AND owner_id = $2`,
      [`${courseCodePrefix}%`, ownerId],
    );

    const generatedCourseIds = generatedCoursesResult.rows.map((row) => row.id);
    let deletedEnrollmentsCount = 0;

    if (generatedCourseIds.length > 0) {
      const deleteEnrollmentsResult = await client.query(
        `DELETE FROM enrollments WHERE course_id = ANY($1) RETURNING id`,
        [generatedCourseIds],
      );
      deletedEnrollmentsCount = deleteEnrollmentsResult.rowCount;
    }

    const deleteCoursesResult = await client.query(
      `DELETE FROM courses WHERE course_code LIKE $1 AND owner_id = $2 RETURNING id`,
      [`${courseCodePrefix}%`, ownerId],
    );

    await refreshStudentCountCache(client);
    await client.query("COMMIT");

    return {
      success: true,
      message: "Generated courses cleared successfully",
      data: {
        deletedCourses: deleteCoursesResult.rowCount,
        deletedRelatedEnrollments: deletedEnrollmentsCount,
        courseCodePrefix,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================
// CE MOCK DATASET — deterministic Computer Engineering data
// ============================================================

const CE_DEPARTMENT = { name: "Computer Engineering", code: "CE" };

const CE_ROOMS = [
  { room_code: "C102", building: "C Block", capacity: 60 },
  { room_code: "C103", building: "C Block", capacity: 60 },
  { room_code: "C202", building: "C Block", capacity: 60 },
  { room_code: "C203", building: "C Block", capacity: 60 },
  { room_code: "C108", building: "C Block", capacity: 45 },
  { room_code: "C109", building: "C Block", capacity: 45 },
  { room_code: "C110", building: "C Block", capacity: 45 },
  { room_code: "C208", building: "C Block", capacity: 45 },
  { room_code: "C209", building: "C Block", capacity: 45 },
  { room_code: "C210", building: "C Block", capacity: 45 },
];

const CE_FACULTY = [
  { full_name: "Prof. Ahmet Yılmaz",  email: "ahmet.yilmaz@ce.edu.tr",  courses: ["CE101", "CE301", "CE206"] },
  { full_name: "Prof. Mehmet Kaya",   email: "mehmet.kaya@ce.edu.tr",   courses: ["CE102", "CE202", "CE105"] },
  { full_name: "Prof. Ayşe Demir",    email: "ayse.demir@ce.edu.tr",    courses: ["CE103", "CE106", "CE306"] },
  { full_name: "Prof. Fatma Çelik",   email: "fatma.celik@ce.edu.tr",   courses: ["CE104", "CE204", "CE305"] },
  { full_name: "Prof. Ali Şahin",     email: "ali.sahin@ce.edu.tr",     courses: ["CE201", "CE401", "CE304"] },
  { full_name: "Prof. Zeynep Arslan", email: "zeynep.arslan@ce.edu.tr", courses: ["CE203", "CE205", "CE406"] },
  { full_name: "Prof. Mustafa Koç",   email: "mustafa.koc@ce.edu.tr",   courses: ["CE302", "CE402", "CE404"] },
  { full_name: "Prof. Elif Güneş",    email: "elif.gunes@ce.edu.tr",    courses: ["CE303", "CE403", "CE405"] },
];

const CE_ASSISTANTS = [
  { full_name: "Arş. Gör. Burak Aydın",  email: "burak.aydin@ce.edu.tr" },
  { full_name: "Arş. Gör. Selin Yıldız", email: "selin.yildiz@ce.edu.tr" },
  { full_name: "Arş. Gör. Can Öztürk",   email: "can.ozturk@ce.edu.tr" },
  { full_name: "Arş. Gör. Deniz Kılıç",  email: "deniz.kilic@ce.edu.tr" },
  { full_name: "Arş. Gör. Emre Doğan",   email: "emre.dogan@ce.edu.tr" },
  { full_name: "Arş. Gör. Gizem Şahin",  email: "gizem.sahin@ce.edu.tr" },
  { full_name: "Arş. Gör. Hakan Yılmaz", email: "hakan.yilmaz@ce.edu.tr" },
  { full_name: "Arş. Gör. İrem Aksoy",   email: "irem.aksoy@ce.edu.tr" },
  { full_name: "Arş. Gör. Kerem Çetin",  email: "kerem.cetin@ce.edu.tr" },
  { full_name: "Arş. Gör. Lale Acar",    email: "lale.acar@ce.edu.tr" },
];

const CE_COURSES = [
  // Year 1
  { course_code: "CE101", course_name: "Introduction to Programming", exam_duration_minutes: 60 },
  { course_code: "CE102", course_name: "Mathematics I",               exam_duration_minutes: 90 },
  { course_code: "CE103", course_name: "Physics I",                   exam_duration_minutes: 60 },
  { course_code: "CE104", course_name: "English for Engineers",       exam_duration_minutes: 45 },
  { course_code: "CE105", course_name: "Calculus",                    exam_duration_minutes: 90 },
  { course_code: "CE106", course_name: "Technical Drawing",           exam_duration_minutes: 30 },
  // Year 2
  { course_code: "CE201", course_name: "Data Structures",             exam_duration_minutes: 75 },
  { course_code: "CE202", course_name: "Mathematics II",              exam_duration_minutes: 90 },
  { course_code: "CE203", course_name: "Digital Logic",               exam_duration_minutes: 60 },
  { course_code: "CE204", course_name: "Discrete Mathematics",        exam_duration_minutes: 75 },
  { course_code: "CE205", course_name: "Computer Organization",       exam_duration_minutes: 60 },
  { course_code: "CE206", course_name: "Probability and Statistics",  exam_duration_minutes: 75 },
  // Year 3
  { course_code: "CE301", course_name: "Algorithms",                  exam_duration_minutes: 75 },
  { course_code: "CE302", course_name: "Database Systems",            exam_duration_minutes: 60 },
  { course_code: "CE303", course_name: "Operating Systems",           exam_duration_minutes: 75 },
  { course_code: "CE304", course_name: "Computer Architecture",       exam_duration_minutes: 60 },
  { course_code: "CE305", course_name: "Programming Languages",       exam_duration_minutes: 60 },
  { course_code: "CE306", course_name: "Theory of Computation",       exam_duration_minutes: 75 },
  // Year 4
  { course_code: "CE401", course_name: "Software Engineering",        exam_duration_minutes: 60 },
  { course_code: "CE402", course_name: "Computer Networks",           exam_duration_minutes: 60 },
  { course_code: "CE403", course_name: "Machine Learning",            exam_duration_minutes: 75 },
  { course_code: "CE404", course_name: "Embedded Systems",            exam_duration_minutes: 60 },
  { course_code: "CE405", course_name: "Distributed Systems",         exam_duration_minutes: 60 },
  { course_code: "CE406", course_name: "Senior Project I",            exam_duration_minutes: 30 },
];

// Student groups: enrollment year encodes the class so student numbers parse correctly.
// Format: YYYY C E NNN — e.g. 202611001 → year 2026, class 1, first edu, #001
const CE_STUDENT_GROUPS = [
  { classNo: 1, educationType: "first",     year: 2026, count: 140 },
  { classNo: 1, educationType: "secondary", year: 2026, count: 140 },
  { classNo: 2, educationType: "first",     year: 2025, count: 113 },
  { classNo: 2, educationType: "secondary", year: 2025, count: 113 },
  { classNo: 3, educationType: "first",     year: 2024, count: 95 },
  { classNo: 3, educationType: "secondary", year: 2024, count: 95 },
  { classNo: 4, educationType: "first",     year: 2023, count: 77 },
  { classNo: 4, educationType: "secondary", year: 2023, count: 77 },
];

// Which course codes each class is enrolled in
const CE_CLASS_COURSE_MAP = {
  1: ["CE101", "CE102", "CE103", "CE104", "CE105", "CE106"],
  2: ["CE201", "CE202", "CE203", "CE204", "CE205", "CE206"],
  3: ["CE301", "CE302", "CE303", "CE304", "CE305", "CE306"],
  4: ["CE401", "CE402", "CE403", "CE404", "CE405", "CE406"],
};

function buildCEStudentName(index) {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return `${firstName} ${lastName}`;
}

async function generateCEMockDataset({ ownerId } = {}) {
  if (!ownerId) return { success: false, message: "ownerId is required" };

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Ensure department exists (shared table, no owner_id)
    const deptResult = await client.query(
      `INSERT INTO departments (name, code)
       VALUES ($1, $2)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [CE_DEPARTMENT.name, CE_DEPARTMENT.code],
    );
    const departmentId = deptResult.rows[0].id;

    // 2. Insert rooms
    let insertedRooms = 0;
    for (const room of CE_ROOMS) {
      const r = await client.query(
        `INSERT INTO rooms (room_code, building, capacity, owner_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (owner_id, room_code) DO NOTHING`,
        [room.room_code, room.building, room.capacity, ownerId],
      );
      insertedRooms += r.rowCount;
    }

    // 3. Insert faculty instructors, collect email→id map
    const facultyIdByEmail = {};
    for (const f of CE_FACULTY) {
      const r = await client.query(
        `INSERT INTO instructors (full_name, email, department_id, instructor_type, owner_id)
         VALUES ($1, $2, $3, 'faculty', $4)
         ON CONFLICT (owner_id, email) DO UPDATE
           SET full_name = EXCLUDED.full_name, instructor_type = 'faculty', updated_at = NOW()
         RETURNING id`,
        [f.full_name, f.email, departmentId, ownerId],
      );
      facultyIdByEmail[f.email] = r.rows[0].id;
    }

    // 4. Insert assistant instructors
    let insertedAssistants = 0;
    for (const a of CE_ASSISTANTS) {
      const r = await client.query(
        `INSERT INTO instructors (full_name, email, department_id, instructor_type, owner_id)
         VALUES ($1, $2, $3, 'assistant', $4)
         ON CONFLICT (owner_id, email) DO UPDATE
           SET full_name = EXCLUDED.full_name, instructor_type = 'assistant', updated_at = NOW()
         RETURNING id`,
        [a.full_name, a.email, departmentId, ownerId],
      );
      insertedAssistants += r.rows[0] ? 1 : 0;
    }

    // 5. Insert courses, collect code→id map
    const courseIdByCode = {};
    for (const c of CE_COURSES) {
      const r = await client.query(
        `INSERT INTO courses (course_code, course_name, department_id, exam_duration_minutes, owner_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (owner_id, course_code) DO UPDATE
           SET course_name = EXCLUDED.course_name, exam_duration_minutes = EXCLUDED.exam_duration_minutes
         RETURNING id`,
        [c.course_code, c.course_name, departmentId, c.exam_duration_minutes, ownerId],
      );
      courseIdByCode[c.course_code] = r.rows[0].id;
    }

    // 6. Link faculty to their courses via course_instructors
    for (const f of CE_FACULTY) {
      const instructorId = facultyIdByEmail[f.email];
      for (const code of f.courses) {
        const courseId = courseIdByCode[code];
        if (courseId && instructorId) {
          await client.query(
            `INSERT INTO course_instructors (course_id, instructor_id, role)
             VALUES ($1, $2, 'primary')
             ON CONFLICT (course_id, instructor_id) DO NOTHING`,
            [courseId, instructorId],
          );
        }
      }
    }

    // 7. Build all student rows deterministically
    const studentRows = []; // [student_no, full_name, email, department_id, class_no, education_type, owner_id]
    let nameIndex = 0;
    for (const group of CE_STUDENT_GROUPS) {
      const eduDigit = group.educationType === "first" ? "1" : "2";
      for (let i = 1; i <= group.count; i += 1) {
        const studentNo = `${group.year}${group.classNo}${eduDigit}${String(i).padStart(3, "0")}`;
        const fullName = buildCEStudentName(nameIndex);
        const email = `${studentNo}@ogr.edu.tr`;
        studentRows.push([studentNo, fullName, email, departmentId, group.classNo, group.educationType, ownerId]);
        nameIndex += 1;
      }
    }

    // 8. Batch insert students
    const studentNos = studentRows.map((r) => r[0]);
    if (studentRows.length > 0) {
      const placeholders = studentRows
        .map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`)
        .join(", ");
      await client.query(
        `INSERT INTO students (student_no, full_name, email, department_id, class_no, education_type, owner_id)
         VALUES ${placeholders}
         ON CONFLICT (student_no) DO NOTHING`,
        studentRows.flat(),
      );
    }

    // 9. Query back inserted students to get their IDs
    const studentsResult = await client.query(
      `SELECT id, class_no FROM students WHERE student_no = ANY($1) AND owner_id = $2`,
      [studentNos, ownerId],
    );

    // 10. Build enrollment pairs (student_id, course_id) based on class_no
    const enrollmentPairs = []; // [student_id, course_id]
    for (const student of studentsResult.rows) {
      const courseCodes = CE_CLASS_COURSE_MAP[student.class_no] || [];
      for (const code of courseCodes) {
        const courseId = courseIdByCode[code];
        if (courseId) enrollmentPairs.push([student.id, courseId]);
      }
    }

    // 11. Batch insert enrollments
    let insertedEnrollments = 0;
    if (enrollmentPairs.length > 0) {
      const enrollPlaceholders = enrollmentPairs
        .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}, 'ce_mock')`)
        .join(", ");
      const enrollResult = await client.query(
        `INSERT INTO enrollments (student_id, course_id, enrollment_source)
         VALUES ${enrollPlaceholders}
         ON CONFLICT (student_id, course_id) DO NOTHING`,
        enrollmentPairs.flat(),
      );
      insertedEnrollments = enrollResult.rowCount;
    }

    // 12. Refresh student count cache
    await refreshStudentCountCache(client);

    await client.query("COMMIT");

    return {
      success: true,
      message: "CE mock dataset generated successfully",
      data: {
        department: CE_DEPARTMENT.name,
        insertedRooms,
        facultyCount: CE_FACULTY.length,
        assistantCount: CE_ASSISTANTS.length,
        courseCount: CE_COURSES.length,
        studentCount: studentsResult.rows.length,
        insertedEnrollments,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function clearCEMockDataset({ ownerId } = {}) {
  if (!ownerId) return { success: false, message: "ownerId is required" };

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Delete course_instructors for this owner's courses
    await client.query(
      `DELETE FROM course_instructors
       WHERE course_id IN (SELECT id FROM courses WHERE owner_id = $1)`,
      [ownerId],
    );

    // Delete enrollments for this owner's students
    const deletedEnrollments = await client.query(
      `DELETE FROM enrollments
       WHERE student_id IN (SELECT id FROM students WHERE owner_id = $1)
       RETURNING id`,
      [ownerId],
    );

    // Delete students
    const deletedStudents = await client.query(
      `DELETE FROM students WHERE owner_id = $1 RETURNING id`,
      [ownerId],
    );

    // Delete courses
    const deletedCourses = await client.query(
      `DELETE FROM courses WHERE owner_id = $1 RETURNING id`,
      [ownerId],
    );

    // Delete instructors
    const deletedInstructors = await client.query(
      `DELETE FROM instructors WHERE owner_id = $1 RETURNING id`,
      [ownerId],
    );

    // Delete rooms
    const deletedRooms = await client.query(
      `DELETE FROM rooms WHERE owner_id = $1 RETURNING id`,
      [ownerId],
    );

    await refreshStudentCountCache(client);
    await client.query("COMMIT");

    return {
      success: true,
      message: "CE mock dataset cleared (all owned data removed)",
      data: {
        deletedEnrollments: deletedEnrollments.rowCount,
        deletedStudents: deletedStudents.rowCount,
        deletedCourses: deletedCourses.rowCount,
        deletedInstructors: deletedInstructors.rowCount,
        deletedRooms: deletedRooms.rowCount,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ── Granular per-step CE mock loaders ──────────────────────────

async function generateCERoomsMock({ ownerId } = {}) {
  if (!ownerId) return { success: false, message: "ownerId is required" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let inserted = 0;
    for (const room of CE_ROOMS) {
      const r = await client.query(
        `INSERT INTO rooms (room_code, building, capacity, owner_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (owner_id, room_code) DO NOTHING`,
        [room.room_code, room.building, room.capacity, ownerId],
      );
      inserted += r.rowCount;
    }
    await client.query("COMMIT");
    return { success: true, message: "Mock rooms loaded", data: { inserted, total: CE_ROOMS.length } };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function generateCEInstructorsMock({ ownerId } = {}) {
  if (!ownerId) return { success: false, message: "ownerId is required" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const deptResult = await client.query(
      `INSERT INTO departments (name, code) VALUES ($1, $2)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [CE_DEPARTMENT.name, CE_DEPARTMENT.code],
    );
    const departmentId = deptResult.rows[0].id;
    for (const f of CE_FACULTY) {
      await client.query(
        `INSERT INTO instructors (full_name, email, department_id, instructor_type, owner_id)
         VALUES ($1, $2, $3, 'faculty', $4)
         ON CONFLICT (owner_id, email) DO UPDATE
           SET full_name = EXCLUDED.full_name, instructor_type = 'faculty', updated_at = NOW()`,
        [f.full_name, f.email, departmentId, ownerId],
      );
    }
    for (const a of CE_ASSISTANTS) {
      await client.query(
        `INSERT INTO instructors (full_name, email, department_id, instructor_type, owner_id)
         VALUES ($1, $2, $3, 'assistant', $4)
         ON CONFLICT (owner_id, email) DO UPDATE
           SET full_name = EXCLUDED.full_name, instructor_type = 'assistant', updated_at = NOW()`,
        [a.full_name, a.email, departmentId, ownerId],
      );
    }
    await client.query("COMMIT");
    return {
      success: true,
      message: "Mock instructors loaded",
      data: { faculty: CE_FACULTY.length, assistants: CE_ASSISTANTS.length },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function generateCECoursesMock({ ownerId } = {}) {
  if (!ownerId) return { success: false, message: "ownerId is required" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const deptResult = await client.query(
      `INSERT INTO departments (name, code) VALUES ($1, $2)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [CE_DEPARTMENT.name, CE_DEPARTMENT.code],
    );
    const departmentId = deptResult.rows[0].id;
    const courseIdByCode = {};
    for (const c of CE_COURSES) {
      const r = await client.query(
        `INSERT INTO courses (course_code, course_name, department_id, exam_duration_minutes, owner_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (owner_id, course_code) DO UPDATE
           SET course_name = EXCLUDED.course_name, exam_duration_minutes = EXCLUDED.exam_duration_minutes
         RETURNING id`,
        [c.course_code, c.course_name, departmentId, c.exam_duration_minutes, ownerId],
      );
      courseIdByCode[c.course_code] = r.rows[0].id;
    }
    // Link faculty to courses if instructors already exist
    for (const f of CE_FACULTY) {
      const instrResult = await client.query(
        `SELECT id FROM instructors WHERE owner_id = $1 AND email = $2 LIMIT 1`,
        [ownerId, f.email],
      );
      if (instrResult.rows.length > 0) {
        const instructorId = instrResult.rows[0].id;
        for (const code of f.courses) {
          const courseId = courseIdByCode[code];
          if (courseId) {
            await client.query(
              `INSERT INTO course_instructors (course_id, instructor_id, role)
               VALUES ($1, $2, 'primary')
               ON CONFLICT (course_id, instructor_id) DO NOTHING`,
              [courseId, instructorId],
            );
          }
        }
      }
    }
    await client.query("COMMIT");
    return { success: true, message: "Mock courses loaded", data: { courses: CE_COURSES.length } };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function generateCEStudentsMock({ ownerId } = {}) {
  if (!ownerId) return { success: false, message: "ownerId is required" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const deptResult = await client.query(
      `INSERT INTO departments (name, code) VALUES ($1, $2)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [CE_DEPARTMENT.name, CE_DEPARTMENT.code],
    );
    const departmentId = deptResult.rows[0].id;
    const studentRows = [];
    let nameIndex = 0;
    for (const group of CE_STUDENT_GROUPS) {
      const eduDigit = group.educationType === "first" ? "1" : "2";
      for (let i = 1; i <= group.count; i += 1) {
        const studentNo = `${group.year}${group.classNo}${eduDigit}${String(i).padStart(3, "0")}`;
        const fullName = buildCEStudentName(nameIndex);
        const email = `${studentNo}@ogr.edu.tr`;
        studentRows.push([studentNo, fullName, email, departmentId, group.classNo, group.educationType, ownerId]);
        nameIndex += 1;
      }
    }
    if (studentRows.length > 0) {
      const placeholders = studentRows
        .map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`)
        .join(", ");
      await client.query(
        `INSERT INTO students (student_no, full_name, email, department_id, class_no, education_type, owner_id)
         VALUES ${placeholders}
         ON CONFLICT (student_no) DO NOTHING`,
        studentRows.flat(),
      );
    }
    const studentNos = studentRows.map((r) => r[0]);
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS n FROM students WHERE student_no = ANY($1) AND owner_id = $2`,
      [studentNos, ownerId],
    );
    await client.query("COMMIT");
    return {
      success: true,
      message: "Mock students loaded",
      data: { students: countResult.rows[0].n },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function generateCEEnrollmentsMock({ ownerId } = {}) {
  if (!ownerId) return { success: false, message: "ownerId is required" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const coursesResult = await client.query(
      `SELECT id, course_code FROM courses WHERE owner_id = $1 AND course_code LIKE 'CE%'`,
      [ownerId],
    );
    if (coursesResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, message: "No CE courses found. Load courses first." };
    }
    const courseIdByCode = {};
    for (const row of coursesResult.rows) courseIdByCode[row.course_code] = row.id;

    const studentsResult = await client.query(
      `SELECT id, class_no FROM students WHERE owner_id = $1 AND class_no IS NOT NULL`,
      [ownerId],
    );
    if (studentsResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, message: "No students found. Load students first." };
    }

    const enrollmentPairs = [];
    for (const student of studentsResult.rows) {
      const courseCodes = CE_CLASS_COURSE_MAP[student.class_no] || [];
      for (const code of courseCodes) {
        const courseId = courseIdByCode[code];
        if (courseId) enrollmentPairs.push([student.id, courseId]);
      }
    }

    let insertedEnrollments = 0;
    if (enrollmentPairs.length > 0) {
      const enrollPlaceholders = enrollmentPairs
        .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}, 'ce_mock')`)
        .join(", ");
      const result = await client.query(
        `INSERT INTO enrollments (student_id, course_id, enrollment_source)
         VALUES ${enrollPlaceholders}
         ON CONFLICT (student_id, course_id) DO NOTHING`,
        enrollmentPairs.flat(),
      );
      insertedEnrollments = result.rowCount;
    }

    await refreshStudentCountCache(client);
    await client.query("COMMIT");
    return {
      success: true,
      message: "Mock enrollments loaded",
      data: { insertedEnrollments, studentsProcessed: studentsResult.rows.length },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export {
  generateDemoDataset,
  clearGeneratedDataset,
  generateDemoCourses,
  clearGeneratedCourses,
  generateCEMockDataset,
  clearCEMockDataset,
  generateCERoomsMock,
  generateCEInstructorsMock,
  generateCECoursesMock,
  generateCEStudentsMock,
  generateCEEnrollmentsMock,
};

export default {
  generateDemoDataset,
  clearGeneratedDataset,
  generateDemoCourses,
  clearGeneratedCourses,
  generateCEMockDataset,
  clearCEMockDataset,
  generateCERoomsMock,
  generateCEInstructorsMock,
  generateCECoursesMock,
  generateCEStudentsMock,
  generateCEEnrollmentsMock,
};
