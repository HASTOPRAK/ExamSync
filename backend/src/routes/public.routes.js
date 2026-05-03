import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// GET /api/public/schedule/:studentNo
// Returns the exam schedule for a student by student number — no auth required.
router.get("/schedule/:studentNo", async (req, res) => {
  try {
    const { studentNo } = req.params;

    if (!studentNo || !String(studentNo).trim()) {
      return res.status(400).json({ success: false, message: "studentNo is required" });
    }

    const studentResult = await pool.query(
      `SELECT id, full_name, student_no, class_no, education_type FROM students WHERE student_no = $1`,
      [String(studentNo).trim()],
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const student = studentResult.rows[0];

    const result = await pool.query(
      `SELECT
         c.course_code,
         c.course_name,
         c.exam_duration_minutes,
         ep.name            AS exam_period_name,
         ep.academic_year,
         ep.term,
         ep.exam_type,
         ts.slot_date,
         ts.start_time,
         ts.end_time,
         STRING_AGG(r.room_code, ', ' ORDER BY r.room_code) AS rooms,
         e.status           AS exam_status,
         e.notes
       FROM enrollments en
       JOIN courses c         ON c.id = en.course_id
       JOIN exams e           ON e.course_id = c.id
       JOIN exam_periods ep   ON ep.id = e.exam_period_id
       LEFT JOIN time_slots ts ON ts.id = e.time_slot_id
       LEFT JOIN exam_room_assignments era ON era.exam_id = e.id
       LEFT JOIN rooms r      ON r.id = era.room_id
       WHERE en.student_id = $1
         AND e.status != 'draft'
       GROUP BY c.course_code, c.course_name, c.exam_duration_minutes,
                ep.name, ep.academic_year, ep.term, ep.exam_type,
                ts.slot_date, ts.start_time, ts.end_time,
                e.status, e.notes
       ORDER BY ts.slot_date NULLS LAST, ts.start_time NULLS LAST`,
      [student.id],
    );

    return res.status(200).json({
      success: true,
      student: {
        student_no: student.student_no,
        full_name: student.full_name,
        class_no: student.class_no,
        education_type: student.education_type,
      },
      data: result.rows,
    });
  } catch (error) {
    console.error("Public schedule error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch schedule" });
  }
});

export default router;
