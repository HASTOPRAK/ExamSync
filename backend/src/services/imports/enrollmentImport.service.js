import pool from "../../config/db.js";
import parseCsvBuffer from "../../utils/parseCsvBuffer.js";

const REQUIRED_COLUMNS = ["student_no", "course_code"];
const TEMPLATE_HEADERS = ["student_no", "course_code"];
const TEMPLATE_ROWS = ["20210001,CSE101", "20210002,CSE102"];
const STUDENT_REQUIRED_COLUMNS = ["student_no", "full_name"];

function buildTemplateCsv() {
  return [TEMPLATE_HEADERS.join(","), ...TEMPLATE_ROWS].join("\n");
}

function buildStudentTemplateCsv() {
  return [
    "student_no,full_name,class_no",
    "20260001,Ali Yılmaz,1",
    "20260002,Ayşe Demir,2",
  ].join("\n");
}

function validateHeaders(rows) {
  if (!rows.length) {
    return { ok: false, message: "CSV file is empty" };
  }

  const headers = Object.keys(rows[0]);
  const missingHeaders = REQUIRED_COLUMNS.filter(
    (column) => !headers.includes(column),
  );

  if (missingHeaders.length > 0) {
    return { ok: false, message: `Missing required columns: ${missingHeaders.join(", ")}` };
  }

  return { ok: true };
}

async function previewEnrollmentImport(fileBuffer, ownerId) {
  const rows = parseCsvBuffer(fileBuffer);
  const headerCheck = validateHeaders(rows);

  if (!headerCheck.ok) {
    return { success: false, message: headerCheck.message, data: null };
  }

  const errors = [];
  const validRows = [];
  const duplicateKeysInFile = new Set();

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const row = rows[index];

    const studentNo = row.student_no;
    const courseCode = row.course_code;

    if (!studentNo) {
      errors.push({ row: rowNumber, field: "student_no", message: "student_no is required" });
      continue;
    }
    if (!courseCode) {
      errors.push({ row: rowNumber, field: "course_code", message: "course_code is required" });
      continue;
    }

    const uniqueKey = `${studentNo}__${courseCode}`;
    if (duplicateKeysInFile.has(uniqueKey)) {
      errors.push({ row: rowNumber, field: "student_no, course_code", message: "Duplicate enrollment found inside uploaded file" });
      continue;
    }

    duplicateKeysInFile.add(uniqueKey);
    validRows.push({ row: rowNumber, studentNo, courseCode });
  }

  const studentNos = [...new Set(validRows.map((row) => row.studentNo))];
  const courseCodes = [...new Set(validRows.map((row) => row.courseCode))];

  const [studentsResult, coursesResult] = await Promise.all([
    pool.query(
      `SELECT id, student_no FROM students WHERE student_no = ANY($1) AND owner_id = $2`,
      [studentNos, ownerId],
    ),
    pool.query(
      `SELECT id, course_code FROM courses WHERE course_code = ANY($1) AND owner_id = $2`,
      [courseCodes, ownerId],
    ),
  ]);

  const studentMap = new Map(
    studentsResult.rows.map((student) => [student.student_no, student.id]),
  );
  const courseMap = new Map(
    coursesResult.rows.map((course) => [course.course_code, course.id]),
  );

  const resolvedRows = [];
  const insertCandidates = [];

  for (const row of validRows) {
    const studentId = studentMap.get(row.studentNo);
    const courseId = courseMap.get(row.courseCode);

    if (!studentId) {
      errors.push({ row: row.row, field: "student_no", message: `Student not found: ${row.studentNo}` });
      continue;
    }
    if (!courseId) {
      errors.push({ row: row.row, field: "course_code", message: `Course not found: ${row.courseCode}` });
      continue;
    }

    resolvedRows.push({ ...row, studentId, courseId });
    insertCandidates.push({ row: row.row, studentNo: row.studentNo, courseCode: row.courseCode, studentId, courseId });
  }

  let existingEnrollmentKeys = new Set();

  if (insertCandidates.length > 0) {
    const values = insertCandidates.flatMap((item) => [item.studentId, item.courseId]);
    const placeholders = insertCandidates
      .map((_, index) => `($${index * 2 + 1}::int, $${index * 2 + 2}::int)`)
      .join(", ");

    const existingResult = await pool.query(
      `SELECT e.student_id, e.course_id
       FROM enrollments e
       JOIN (VALUES ${placeholders}) AS incoming(student_id, course_id)
         ON incoming.student_id = e.student_id
        AND incoming.course_id = e.course_id`,
      values,
    );

    existingEnrollmentKeys = new Set(
      existingResult.rows.map((item) => `${item.student_id}__${item.course_id}`),
    );
  }

  const readyToImport = [];
  const duplicatesInDatabase = [];

  for (const item of insertCandidates) {
    const dbKey = `${item.studentId}__${item.courseId}`;
    if (existingEnrollmentKeys.has(dbKey)) {
      duplicatesInDatabase.push({
        row: item.row,
        field: "student_no, course_code",
        message: "Enrollment already exists in database",
      });
      continue;
    }
    readyToImport.push(item);
  }

  return {
    success: true,
    message: "Enrollment import preview generated successfully",
    data: {
      summary: {
        totalRows: rows.length,
        validRows: readyToImport.length,
        invalidRows: errors.length,
        duplicateRowsInDatabase: duplicatesInDatabase.length,
      },
      preview: readyToImport.slice(0, 20).map((item) => ({
        row: item.row,
        student_no: item.studentNo,
        course_code: item.courseCode,
      })),
      errors: [...errors, ...duplicatesInDatabase],
    },
  };
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
      SELECT DISTINCT course_id FROM enrollments
    )
  `);
}

async function commitEnrollmentImport(fileBuffer, ownerId) {
  const previewResult = await previewEnrollmentImport(fileBuffer, ownerId);

  if (!previewResult.success) {
    return previewResult;
  }

  const rows = parseCsvBuffer(fileBuffer);

  const studentNos = [...new Set(rows.map((row) => row.student_no).filter(Boolean))];
  const courseCodes = [...new Set(rows.map((row) => row.course_code).filter(Boolean))];

  const [studentsResult, coursesResult] = await Promise.all([
    pool.query(
      `SELECT id, student_no FROM students WHERE student_no = ANY($1) AND owner_id = $2`,
      [studentNos, ownerId],
    ),
    pool.query(
      `SELECT id, course_code FROM courses WHERE course_code = ANY($1) AND owner_id = $2`,
      [courseCodes, ownerId],
    ),
  ]);

  const studentMap = new Map(
    studentsResult.rows.map((student) => [student.student_no, student.id]),
  );
  const courseMap = new Map(
    coursesResult.rows.map((course) => [course.course_code, course.id]),
  );

  const uniquePairs = new Map();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const studentNo = row.student_no;
    const courseCode = row.course_code;

    if (!studentNo || !courseCode) continue;

    const studentId = studentMap.get(studentNo);
    const courseId = courseMap.get(courseCode);

    if (!studentId || !courseId) continue;

    const key = `${studentId}__${courseId}`;
    if (!uniquePairs.has(key)) {
      uniquePairs.set(key, { studentId, courseId });
    }
  }

  const pairs = [...uniquePairs.values()];
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let insertedCount = 0;

    for (const pair of pairs) {
      const insertResult = await client.query(
        `INSERT INTO enrollments (student_id, course_id, enrollment_source)
         VALUES ($1, $2, 'csv_import')
         ON CONFLICT (student_id, course_id) DO NOTHING`,
        [pair.studentId, pair.courseId],
      );
      insertedCount += insertResult.rowCount;
    }

    await refreshStudentCountCache(client);
    await client.query("COMMIT");

    return {
      success: true,
      message: "Enrollment import committed successfully",
      data: {
        insertedCount,
        skippedCount: pairs.length - insertedCount,
        totalProcessed: pairs.length,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function previewStudentImport(fileBuffer, ownerId) {
  const rows = parseCsvBuffer(fileBuffer);

  if (!rows.length) {
    return { success: false, message: "CSV file is empty" };
  }

  const headers = Object.keys(rows[0]);
  const missing = STUDENT_REQUIRED_COLUMNS.filter((h) => !headers.includes(h));

  if (missing.length) {
    return { success: false, message: `Missing columns: ${missing.join(", ")}` };
  }

  const errors = [];
  const validRows = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    const row = rows[i];
    const studentNo = row.student_no;
    const fullName = row.full_name;

    if (!studentNo) {
      errors.push({ row: rowNumber, field: "student_no", message: "student_no is required" });
      continue;
    }
    if (!fullName) {
      errors.push({ row: rowNumber, field: "full_name", message: "full_name is required" });
      continue;
    }
    const classNo = row.class_no ? parseInt(row.class_no, 10) : null;
    validRows.push({ row: rowNumber, studentNo, fullName, classNo });
  }

  const studentNos = validRows.map((r) => r.studentNo);

  // Check for duplicates within this owner's tenant
  const existing = await pool.query(
    `SELECT student_no FROM students WHERE student_no = ANY($1) AND owner_id = $2`,
    [studentNos, ownerId],
  );

  const existingSet = new Set(existing.rows.map((r) => r.student_no));

  const ready = [];
  const duplicates = [];

  for (const row of validRows) {
    if (existingSet.has(row.studentNo)) {
      duplicates.push({ row: row.row, field: "student_no", message: "Student already exists" });
      continue;
    }
    ready.push(row);
  }

  return {
    success: true,
    message: "Student preview generated",
    data: {
      summary: {
        totalRows: rows.length,
        validRows: ready.length,
        duplicateRows: duplicates.length,
        invalidRows: errors.length,
      },
      preview: ready.slice(0, 20),
      errors: [...errors, ...duplicates],
    },
  };
}

async function commitStudentImport(fileBuffer, ownerId) {
  const rows = parseCsvBuffer(fileBuffer);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let inserted = 0;

    for (const row of rows) {
      const studentNo = row.student_no;
      const fullName = row.full_name;
      const classNo = row.class_no ? parseInt(row.class_no, 10) : null;

      if (!studentNo || !fullName) continue;

      const result = await client.query(
        `INSERT INTO students (student_no, full_name, class_no, department_id, owner_id)
         VALUES ($1, $2, $3, 1, $4)
         ON CONFLICT (owner_id, student_no) DO UPDATE SET class_no = EXCLUDED.class_no WHERE EXCLUDED.class_no IS NOT NULL`,
        [studentNo, fullName, classNo, ownerId],
      );

      inserted += result.rowCount;
    }

    await client.query("COMMIT");

    return {
      success: true,
      message: "Students imported",
      data: { inserted, skipped: rows.length - inserted },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export {
  buildTemplateCsv,
  previewEnrollmentImport,
  commitEnrollmentImport,
  previewStudentImport,
  commitStudentImport,
  buildStudentTemplateCsv,
};

export default {
  buildTemplateCsv,
  previewEnrollmentImport,
  commitEnrollmentImport,
  previewStudentImport,
  commitStudentImport,
  buildStudentTemplateCsv,
};
