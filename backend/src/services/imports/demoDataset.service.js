import pool from "../../config/db.js";

const FIRST_NAMES = [
  "Ahmet",
  "Mehmet",
  "Ayşe",
  "Fatma",
  "Ali",
  "Zeynep",
  "Mustafa",
  "Elif",
  "Can",
  "Deniz",
  "Merve",
  "Emre",
  "Yusuf",
  "Ece",
  "Berk",
  "Seda",
  "Kerem",
  "Selin",
  "Oğuz",
  "Ceren",
];

const LAST_NAMES = [
  "Yılmaz",
  "Kaya",
  "Demir",
  "Çelik",
  "Şahin",
  "Yıldız",
  "Aydın",
  "Arslan",
  "Doğan",
  "Kılıç",
  "Koç",
  "Aslan",
  "Öztürk",
  "Çetin",
  "Kurt",
  "Özdemir",
  "Tekin",
  "Polat",
  "Erdoğan",
  "Avcı",
];

const COURSE_NAME_PARTS = [
  "Algorithms",
  "Programming",
  "Systems",
  "Databases",
  "Networks",
  "AI",
  "Security",
  "Mathematics",
  "Architecture",
  "Software",
  "Web",
  "Mobile",
  "Cloud",
  "Data",
  "Machine Learning",
  "Operating Systems",
  "Discrete Structures",
  "Computer Graphics",
  "Theory",
  "Simulation",
];

function buildRandomCourseName(index) {
  const partA = randomItem(COURSE_NAME_PARTS);
  const partB = randomItem(COURSE_NAME_PARTS);

  if (partA === partB) {
    return `Special Topics ${index}`;
  }

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
    WHERE id NOT IN (
      SELECT DISTINCT course_id
      FROM enrollments
    )
  `);
}

async function generateDemoCourses({
  courseCount = 20,
  courseCodePrefix = "TST",
  startNumber = 101,
  minDuration = 60,
  maxDuration = 90,
} = {}) {
  if (courseCount < 1) {
    return {
      success: false,
      message: "courseCount must be at least 1",
    };
  }

  if (minDuration > maxDuration) {
    return {
      success: false,
      message: "minDuration cannot be greater than maxDuration",
    };
  }

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
        `
        INSERT INTO courses (
          course_code,
          course_name,
          department_id,
          exam_duration_minutes
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (course_code) DO NOTHING
        RETURNING id, course_code, course_name, exam_duration_minutes
        `,
        [courseCode, courseName, 1, examDurationMinutes],
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
        parameters: {
          courseCodePrefix,
          startNumber,
          minDuration,
          maxDuration,
        },
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
} = {}) {
  if (studentCount < 1) {
    return {
      success: false,
      message: "studentCount must be at least 1",
    };
  }

  if (minCoursesPerStudent < 1 || maxCoursesPerStudent < 1) {
    return {
      success: false,
      message: "Course count per student must be at least 1",
    };
  }

  if (minCoursesPerStudent > maxCoursesPerStudent) {
    return {
      success: false,
      message:
        "minCoursesPerStudent cannot be greater than maxCoursesPerStudent",
    };
  }

  const allowedFilterModes = ["all", "include", "exclude"];

  if (!allowedFilterModes.includes(courseFilterMode)) {
    return {
      success: false,
      message: `courseFilterMode must be one of: ${allowedFilterModes.join(", ")}`,
    };
  }

  if (
    (courseFilterMode === "include" || courseFilterMode === "exclude") &&
    !courseCodePrefix
  ) {
    return {
      success: false,
      message:
        "courseCodePrefix is required when courseFilterMode is include or exclude",
    };
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let coursesQuery = `
      SELECT id, course_code
      FROM courses
    `;

    const queryParams = [];

    if (courseFilterMode === "include") {
      queryParams.push(`${courseCodePrefix}%`);
      coursesQuery += ` WHERE course_code LIKE $1 `;
    } else if (courseFilterMode === "exclude") {
      queryParams.push(`${courseCodePrefix}%`);
      coursesQuery += ` WHERE course_code NOT LIKE $1 `;
    }

    coursesQuery += ` ORDER BY course_code ASC `;

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
      `
      SELECT student_no
      FROM students
      WHERE student_no LIKE $1
      ORDER BY student_no DESC
      LIMIT 1
      `,
      [`${studentNoPrefix}%`],
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

    const coursePools = chunkArray(
      courses,
      Math.max(6, Math.ceil(courses.length / 4)),
    );
    const createdStudents = [];
    let insertedEnrollments = 0;

    for (let i = 0; i < studentCount; i += 1) {
      const studentNo = `${studentNoPrefix}${String(nextSequence + i).padStart(4, "0")}`;
      const fullName = buildRandomFullName();

      const studentInsertResult = await client.query(
        `
        INSERT INTO students (student_no, full_name, department_id)
        VALUES ($1, $2, $3)
        RETURNING id, student_no, full_name
        `,
        [studentNo, fullName, 1],
      );

      const student = studentInsertResult.rows[0];
      createdStudents.push(student);

      const targetCourseCount = randomInt(
        minCoursesPerStudent,
        maxCoursesPerStudent,
      );

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

          if (selectedCoursesMap.size >= targetCourseCount) {
            break;
          }
        }
      }

      for (const course of selectedCoursesMap.values()) {
        const enrollmentInsertResult = await client.query(
          `
          INSERT INTO enrollments (student_id, course_id, enrollment_source)
          VALUES ($1, $2, 'demo_generator')
          ON CONFLICT (student_id, course_id) DO NOTHING
          `,
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

async function clearGeneratedDataset({ studentNoPrefix = "2026" } = {}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const deleteEnrollments = await client.query(
      `
      DELETE FROM enrollments
      WHERE enrollment_source = 'demo_generator'
      RETURNING id
      `,
    );

    const deleteStudents = await client.query(
      `
      DELETE FROM students
      WHERE student_no LIKE $1
      RETURNING id
      `,
      [`${studentNoPrefix}%`],
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

async function clearGeneratedCourses({ courseCodePrefix = "TST" } = {}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const generatedCoursesResult = await client.query(
      `
      SELECT id
      FROM courses
      WHERE course_code LIKE $1
      `,
      [`${courseCodePrefix}%`],
    );

    const generatedCourseIds = generatedCoursesResult.rows.map((row) => row.id);

    let deletedEnrollmentsCount = 0;

    if (generatedCourseIds.length > 0) {
      const deleteEnrollmentsResult = await client.query(
        `
        DELETE FROM enrollments
        WHERE course_id = ANY($1)
        RETURNING id
        `,
        [generatedCourseIds],
      );

      deletedEnrollmentsCount = deleteEnrollmentsResult.rowCount;
    }

    const deleteCoursesResult = await client.query(
      `
      DELETE FROM courses
      WHERE course_code LIKE $1
      RETURNING id
      `,
      [`${courseCodePrefix}%`],
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

export {
  generateDemoDataset,
  clearGeneratedDataset,
  generateDemoCourses,
  clearGeneratedCourses,
};
export default {
  generateDemoDataset,
  clearGeneratedDataset,
  generateDemoCourses,
  clearGeneratedCourses,
};
