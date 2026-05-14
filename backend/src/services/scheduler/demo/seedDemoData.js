import db from "../../../config/db.js";
import { PRESETS } from "./presets.js";

/**
 * Wipes all data owned by this user (rooms, instructors, courses, students,
 * enrollments, and any scheduled exams) then re-seeds from the chosen preset.
 *
 * Exam periods and time slots are deliberately left untouched — the user
 * controls those separately. After seeding, they can run the scheduler
 * against any existing exam period that already has time slots configured.
 *
 * WARNING: This replaces all owner-scoped data. Use only for testing.
 */
async function seedDemoData(ownerId, presetName) {
  const preset = PRESETS[presetName];

  if (!preset) {
    const valid = Object.keys(PRESETS).join(", ");
    throw new Error(`Unknown preset "${presetName}". Valid options: ${valid}`);
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // ── Clear scheduled exam results (all periods owned by this user) ──
    await client.query(
      `DELETE FROM exam_room_assignments
       WHERE exam_id IN (
         SELECT e.id FROM exams e
         JOIN exam_periods ep ON ep.id = e.exam_period_id
         WHERE ep.owner_id = $1
       )`,
      [ownerId],
    );
    await client.query(
      `DELETE FROM exams
       WHERE exam_period_id IN (SELECT id FROM exam_periods WHERE owner_id = $1)`,
      [ownerId],
    );
    await client.query(
      `DELETE FROM time_slots
       WHERE exam_period_id IN (SELECT id FROM exam_periods WHERE owner_id = $1)`,
      [ownerId],
    );
    await client.query(`DELETE FROM exam_periods WHERE owner_id = $1`, [ownerId]);

    // ── Clear owner-scoped catalogue data ─────────────────────────────
    await client.query(
      `DELETE FROM enrollments
       WHERE course_id IN (SELECT id FROM courses WHERE owner_id = $1)`,
      [ownerId],
    );
    await client.query(
      `DELETE FROM course_instructors
       WHERE course_id IN (SELECT id FROM courses WHERE owner_id = $1)`,
      [ownerId],
    );
    await client.query(`DELETE FROM courses     WHERE owner_id = $1`, [ownerId]);
    await client.query(`DELETE FROM rooms       WHERE owner_id = $1`, [ownerId]);
    await client.query(`DELETE FROM instructors WHERE owner_id = $1`, [ownerId]);
    await client.query(`DELETE FROM students    WHERE owner_id = $1`, [ownerId]);

    // ── Resolve a department_id for demo records ───────────────────────
    // Departments are global (no owner_id). Fetch the first available one,
    // or create a "Demo" placeholder if the table is empty.
    const { rows: deptRows } = await client.query(
      `SELECT id FROM departments ORDER BY id LIMIT 1`,
    );
    let demoDepartmentId;
    if (deptRows.length > 0) {
      demoDepartmentId = deptRows[0].id;
    } else {
      const { rows: newDept } = await client.query(
        `INSERT INTO departments (name, code)
         VALUES ('Demo Department', 'DEMO')
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
      );
      demoDepartmentId = newDept[0].id;
    }

    // ── Insert rooms ───────────────────────────────────────────────────
    const roomIds = [];

    for (const room of preset.rooms) {
      const { rows } = await client.query(
        `INSERT INTO rooms (room_code, building, capacity, is_active, owner_id)
         VALUES ($1, $2, $3, true, $4)
         RETURNING id`,
        [room.room_code, room.building, room.capacity, ownerId],
      );
      roomIds.push(rows[0].id);
    }

    // ── Insert instructors ─────────────────────────────────────────────
    const instructorIds = [];

    for (const instructor of preset.instructors) {
      const { rows } = await client.query(
        `INSERT INTO instructors (full_name, email, instructor_type, is_available, owner_id)
         VALUES ($1, $2, $3, true, $4)
         RETURNING id`,
        [instructor.full_name, instructor.email, instructor.instructor_type, ownerId],
      );
      instructorIds.push(rows[0].id);
    }

    // ── Insert courses ─────────────────────────────────────────────────
    const courseIds = [];

    for (const course of preset.courses) {
      const { rows } = await client.query(
        `INSERT INTO courses
           (course_code, course_name, department_id, exam_duration_minutes, student_count_cache, is_active, owner_id)
         VALUES ($1, $2, $3, $4, 0, true, $5)
         RETURNING id`,
        [course.course_code, course.course_name, demoDepartmentId, course.exam_duration_minutes, ownerId],
      );
      courseIds.push(rows[0].id);
    }

    // ── Assign a primary instructor to every course (round-robin) ──────
    for (let i = 0; i < courseIds.length; i++) {
      const instructorId = instructorIds[i % instructorIds.length];
      await client.query(
        `INSERT INTO course_instructors (course_id, instructor_id, role)
         VALUES ($1, $2, 'primary')`,
        [courseIds[i], instructorId],
      );
    }

    // ── Generate students + enrollments from cohort definitions ────────
    let studentCounter = 0;
    let enrollmentCount = 0;

    for (const cohort of preset.enrollment.cohorts) {
      for (let i = 0; i < cohort.size; i++) {
        const studentNo = `DEMO${String(studentCounter + 1).padStart(6, "0")}`;
        const fullName = `Demo Student ${studentCounter + 1}`;

        const { rows: studentRows } = await client.query(
          `INSERT INTO students (student_no, full_name, department_id, owner_id)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [studentNo, fullName, demoDepartmentId, ownerId],
        );
        const studentId = studentRows[0].id;

        for (const courseIdx of cohort.courseIndices) {
          await client.query(
            `INSERT INTO enrollments (student_id, course_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [studentId, courseIds[courseIdx]],
          );
          enrollmentCount++;
        }

        studentCounter++;
      }
    }

    // ── Refresh student_count_cache ────────────────────────────────────
    await client.query(
      `UPDATE courses
       SET student_count_cache = (
         SELECT COUNT(*) FROM enrollments WHERE course_id = courses.id
       )
       WHERE owner_id = $1`,
      [ownerId],
    );

    await client.query("COMMIT");

    console.log(
      `[DEMO SEED] preset=${presetName}  courses=${courseIds.length}  ` +
      `rooms=${roomIds.length}  students=${studentCounter}  ` +
      `enrollments=${enrollmentCount}`,
    );

    return {
      preset: presetName,
      label: preset.meta.label,
      expectedScore: preset.meta.expectedScore,
      courses: courseIds.length,
      rooms: roomIds.length,
      instructors: instructorIds.length,
      students: studentCounter,
      enrollments: enrollmentCount,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export default seedDemoData;
