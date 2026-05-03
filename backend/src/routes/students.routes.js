import express from "express";
import pool from "../config/db.js";
import { requireRole } from "../middlewares/auth.middleware.js";

const router = express.Router();

// GET /api/students — teacher/admin only, returns only their students
router.get("/", requireRole("teacher", "admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, student_no, full_name, email, semester_no, class_no, education_type, status
       FROM students
       WHERE owner_id = $1
       ORDER BY class_no, education_type, student_no
       LIMIT 100`,
      [req.user.id],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error fetching students:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch students" });
  }
});

// GET /api/students/my-schedule — student's own exam schedule
router.get("/my-schedule", requireRole("student"), async (req, res) => {
  try {
    const studentResult = await pool.query(
      "SELECT id FROM students WHERE user_id = $1",
      [req.user.id],
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Student profile not found" });
    }

    const studentId = studentResult.rows[0].id;

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
       ORDER BY ts.slot_date, ts.start_time`,
      [studentId],
    );

    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("my-schedule error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch schedule" });
  }
});

export default router;
