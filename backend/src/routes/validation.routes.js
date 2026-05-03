import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// GET basic dataset summary
router.get("/summary", async (req, res) => {
  try {
    const [
      studentsRes,
      coursesRes,
      enrollmentsRes,
      roomsRes,
      examPeriodsRes,
      timeSlotsRes,
      examsRes,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM students`),
      pool.query(`SELECT COUNT(*)::int AS count FROM courses`),
      pool.query(`SELECT COUNT(*)::int AS count FROM enrollments`),
      pool.query(`SELECT COUNT(*)::int AS count FROM rooms`),
      pool.query(`SELECT COUNT(*)::int AS count FROM exam_periods`),
      pool.query(`SELECT COUNT(*)::int AS count FROM time_slots`),
      pool.query(`SELECT COUNT(*)::int AS count FROM exams`),
    ]);

    res.json({
      students: studentsRes.rows[0].count,
      courses: coursesRes.rows[0].count,
      enrollments: enrollmentsRes.rows[0].count,
      rooms: roomsRes.rows[0].count,
      examPeriods: examPeriodsRes.rows[0].count,
      timeSlots: timeSlotsRes.rows[0].count,
      exams: examsRes.rows[0].count,
    });
  } catch (error) {
    console.error("Error fetching validation summary:", error.message);
    res.status(500).json({ error: "Failed to fetch validation summary" });
  }
});

// GET course conflict pairs preview
router.get("/conflicts-preview", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        e1.course_id AS course_1_id,
        c1.course_code AS course_1_code,
        c1.course_name AS course_1_name,
        e2.course_id AS course_2_id,
        c2.course_code AS course_2_code,
        c2.course_name AS course_2_name,
        COUNT(*)::int AS shared_students
      FROM enrollments e1
      JOIN enrollments e2
        ON e1.student_id = e2.student_id
       AND e1.course_id < e2.course_id
      JOIN courses c1 ON e1.course_id = c1.id
      JOIN courses c2 ON e2.course_id = c2.id
      GROUP BY
        e1.course_id, c1.course_code, c1.course_name,
        e2.course_id, c2.course_code, c2.course_name
      HAVING COUNT(*) > 0
      ORDER BY shared_students DESC, c1.course_code, c2.course_code
      LIMIT 100
    `);

    res.json({
      totalConflictPairs: result.rowCount,
      conflicts: result.rows,
    });
  } catch (error) {
    console.error("Error fetching conflicts preview:", error.message);
    res.status(500).json({ error: "Failed to fetch conflicts preview" });
  }
});

export default router;
