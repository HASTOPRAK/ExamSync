import pool from "../../config/db.js";
import parseCsvBuffer from "../../utils/parseCsvBuffer.js";

const REQUIRED_COLUMNS = [
  "course_code",
  "course_name",
  "exam_duration_minutes",
];

function buildCourseTemplateCsv() {
  return [
    "course_code,course_name,exam_duration_minutes",
    "CENG101,Introduction to Programming,60",
    "CENG102,Discrete Mathematics,60",
    "CENG201,Data Structures,75",
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

function parseDuration(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

async function previewCourseImport(fileBuffer, ownerId) {
  const rows = parseCsvBuffer(fileBuffer);
  const headerCheck = validateHeaders(rows);

  if (!headerCheck.ok) {
    return { success: false, message: headerCheck.message };
  }

  const errors = [];
  const validRows = [];
  const duplicateCodesInFile = new Set();

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const row = rows[index];

    const courseCode = row.course_code;
    const courseName = row.course_name;
    const duration = parseDuration(row.exam_duration_minutes);

    if (!courseCode) {
      errors.push({ row: rowNumber, field: "course_code", message: "course_code is required" });
      continue;
    }
    if (!courseName) {
      errors.push({ row: rowNumber, field: "course_name", message: "course_name is required" });
      continue;
    }
    if (duration === null) {
      errors.push({ row: rowNumber, field: "exam_duration_minutes", message: "exam_duration_minutes must be a number" });
      continue;
    }
    if (duration < 15 || duration > 90) {
      errors.push({ row: rowNumber, field: "exam_duration_minutes", message: "exam_duration_minutes must be between 15 and 90" });
      continue;
    }
    if (duplicateCodesInFile.has(courseCode)) {
      errors.push({ row: rowNumber, field: "course_code", message: "Duplicate course_code found inside uploaded file" });
      continue;
    }

    duplicateCodesInFile.add(courseCode);
    validRows.push({ row: rowNumber, courseCode, courseName, examDurationMinutes: duration });
  }

  const courseCodes = validRows.map((row) => row.courseCode);

  const existingResult = await pool.query(
    `SELECT course_code FROM courses WHERE course_code = ANY($1) AND owner_id = $2`,
    [courseCodes, ownerId],
  );

  const existingSet = new Set(existingResult.rows.map((row) => row.course_code));

  const readyToImport = [];
  const duplicatesInDatabase = [];

  for (const row of validRows) {
    if (existingSet.has(row.courseCode)) {
      duplicatesInDatabase.push({
        row: row.row,
        field: "course_code",
        message: "Course already exists in database",
      });
      continue;
    }
    readyToImport.push(row);
  }

  return {
    success: true,
    message: "Course import preview generated successfully",
    data: {
      summary: {
        totalRows: rows.length,
        validRows: readyToImport.length,
        invalidRows: errors.length,
        duplicateRowsInDatabase: duplicatesInDatabase.length,
      },
      preview: readyToImport.slice(0, 20).map((row) => ({
        row: row.row,
        course_code: row.courseCode,
        course_name: row.courseName,
        exam_duration_minutes: row.examDurationMinutes,
      })),
      errors: [...errors, ...duplicatesInDatabase],
    },
  };
}

async function commitCourseImport(fileBuffer, ownerId) {
  const previewResult = await previewCourseImport(fileBuffer, ownerId);

  if (!previewResult.success) {
    return previewResult;
  }

  const rows = parseCsvBuffer(fileBuffer);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const validRows = rows.filter((row) => {
      const duration = parseDuration(row.exam_duration_minutes);
      return row.course_code && row.course_name && duration !== null && duration >= 15 && duration <= 90;
    });

    let inserted = 0;

    if (validRows.length > 0) {
      const courseCodes = validRows.map((r) => r.course_code);
      const courseNames = validRows.map((r) => r.course_name);
      const durations = validRows.map((r) => parseDuration(r.exam_duration_minutes));
      const ownerIds = validRows.map(() => ownerId);

      const result = await client.query(
        `INSERT INTO courses (course_code, course_name, department_id, exam_duration_minutes, owner_id)
         SELECT course_code, course_name, 1, exam_duration_minutes, owner_id
         FROM UNNEST($1::text[], $2::text[], $3::int[], $4::int[])
           AS t(course_code, course_name, exam_duration_minutes, owner_id)
         ON CONFLICT (owner_id, course_code) DO NOTHING`,
        [courseCodes, courseNames, durations, ownerIds],
      );

      inserted = result.rowCount;
    }

    await client.query("COMMIT");

    return {
      success: true,
      message: "Courses imported successfully",
      data: { inserted, skipped: rows.length - inserted },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export { buildCourseTemplateCsv, previewCourseImport, commitCourseImport };

export default {
  buildCourseTemplateCsv,
  previewCourseImport,
  commitCourseImport,
};
