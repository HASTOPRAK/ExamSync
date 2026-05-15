import express from "express";
import pool from "../config/db.js";
import { cacheGet, cacheSet } from "../utils/scheduleCache.js";

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
    const studentPayload = {
      student_no: student.student_no,
      full_name: student.full_name,
      class_no: student.class_no,
      education_type: student.education_type,
    };

    const cacheKey = `student:${student.id}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, student: studentPayload, data: cached });
    }

    const result = await pool.query(
      `SELECT
         c.course_code,
         c.course_name,
         c.exam_duration_minutes,
         ep.name            AS exam_period_name,
         ep.academic_year,
         ep.term,
         ep.exam_type,
         ts.slot_date::text AS slot_date,
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
         AND ep.status = 'published'
       GROUP BY c.course_code, c.course_name, c.exam_duration_minutes,
                ep.name, ep.academic_year, ep.term, ep.exam_type,
                ts.slot_date, ts.start_time, ts.end_time,
                e.status, e.notes
       ORDER BY ts.slot_date NULLS LAST, ts.start_time NULLS LAST`,
      [student.id],
    );

    cacheSet(cacheKey, result.rows);

    return res.status(200).json({
      success: true,
      student: studentPayload,
      data: result.rows,
    });
  } catch (error) {
    console.error("Public schedule error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch schedule" });
  }
});

// GET /api/public/instructor-schedule?name=...
// Returns the exam schedule for an instructor by name — no auth required.
// Returns both faculty (primary instructor) and supervisor duties.
router.get("/instructor-schedule", async (req, res) => {
  try {
    const name = String(req.query.name || "").trim();

    if (!name) {
      return res.status(400).json({ success: false, message: "name is required" });
    }

    const instructorResult = await pool.query(
      `SELECT id, full_name, email, instructor_type
       FROM instructors
       WHERE LOWER(full_name) LIKE LOWER($1)
       ORDER BY full_name
       LIMIT 10`,
      [`%${name}%`],
    );

    if (instructorResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "No instructor found with that name" });
    }

    const instructorIds = instructorResult.rows.map((r) => r.id);

    const result = await pool.query(
      `SELECT
         i.id               AS instructor_id,
         i.full_name        AS instructor_name,
         'faculty'          AS role,
         NULL               AS room_code,
         c.course_code,
         c.course_name,
         ep.name            AS exam_period_name,
         ep.academic_year,
         ep.term,
         ep.exam_type,
         ts.slot_date::text AS slot_date,
         ts.start_time,
         ts.end_time,
         e.status           AS exam_status,
         e.notes
       FROM instructors i
       JOIN exams e         ON e.primary_instructor_id = i.id
       JOIN courses c       ON c.id = e.course_id
       JOIN exam_periods ep ON ep.id = e.exam_period_id
       LEFT JOIN time_slots ts ON ts.id = e.time_slot_id
       WHERE i.id = ANY($1)
         AND ep.status = 'published'

       UNION ALL

       SELECT
         i.id               AS instructor_id,
         i.full_name        AS instructor_name,
         'supervisor'       AS role,
         STRING_AGG(r.room_code, ', ' ORDER BY r.room_code) AS room_code,
         c.course_code,
         c.course_name,
         ep.name            AS exam_period_name,
         ep.academic_year,
         ep.term,
         ep.exam_type,
         ts.slot_date::text AS slot_date,
         ts.start_time,
         ts.end_time,
         e.status           AS exam_status,
         e.notes
       FROM instructors i
       JOIN exam_room_assignments era ON era.supervisor_instructor_id = i.id
       JOIN exams e         ON e.id = era.exam_id
       JOIN rooms r         ON r.id = era.room_id
       JOIN courses c       ON c.id = e.course_id
       JOIN exam_periods ep ON ep.id = e.exam_period_id
       LEFT JOIN time_slots ts ON ts.id = e.time_slot_id
       WHERE i.id = ANY($1)
         AND ep.status = 'published'
       GROUP BY i.id, i.full_name, c.course_code, c.course_name,
                ep.name, ep.academic_year, ep.term, ep.exam_type,
                ts.slot_date, ts.start_time, ts.end_time,
                e.status, e.notes

       ORDER BY slot_date NULLS LAST, start_time NULLS LAST, course_code`,
      [instructorIds],
    );

    return res.status(200).json({
      success: true,
      instructors: instructorResult.rows,
      data: result.rows,
    });
  } catch (error) {
    console.error("Public instructor schedule error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch instructor schedule" });
  }
});

export default router;
