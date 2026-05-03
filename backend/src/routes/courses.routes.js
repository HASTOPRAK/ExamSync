import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// GET /api/courses — list all courses for this owner
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, course_code, course_name, exam_duration_minutes, student_count_cache, is_active
       FROM courses
       WHERE owner_id = $1
       ORDER BY course_code ASC`,
      [req.user.id],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error fetching courses:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch courses" });
  }
});

// GET /api/courses/:id
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, course_code, course_name, exam_duration_minutes, student_count_cache, is_active
       FROM courses
       WHERE id = $1 AND owner_id = $2`,
      [req.params.id, req.user.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error fetching course:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch course" });
  }
});

// POST /api/courses
router.post("/", async (req, res) => {
  try {
    const {
      course_code: courseCode,
      course_name: courseName,
      exam_duration_minutes: examDurationMinutes,
      is_active: isActive = true,
    } = req.body ?? {};

    if (!courseCode || !String(courseCode).trim()) {
      return res.status(400).json({ success: false, message: "course_code is required" });
    }
    if (!courseName || !String(courseName).trim()) {
      return res.status(400).json({ success: false, message: "course_name is required" });
    }

    const duration = Number.parseInt(examDurationMinutes, 10);
    if (Number.isNaN(duration) || duration < 15) {
      return res.status(400).json({ success: false, message: "exam_duration_minutes must be a number ≥ 15" });
    }

    const result = await pool.query(
      `INSERT INTO courses (course_code, course_name, department_id, exam_duration_minutes, is_active, owner_id)
       VALUES ($1, $2, 1, $3, $4, $5)
       RETURNING id, course_code, course_name, exam_duration_minutes, student_count_cache, is_active`,
      [String(courseCode).trim(), String(courseName).trim(), duration, Boolean(isActive), req.user.id],
    );

    res.status(201).json({ success: true, message: "Course created successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Error creating course:", error.message);
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "Course code already exists" });
    }
    res.status(500).json({ success: false, message: "Failed to create course" });
  }
});

// PUT /api/courses/:id
router.put("/:id", async (req, res) => {
  try {
    const {
      course_code: courseCode,
      course_name: courseName,
      exam_duration_minutes: examDurationMinutes,
      is_active: isActive = true,
    } = req.body ?? {};

    if (!courseCode || !String(courseCode).trim()) {
      return res.status(400).json({ success: false, message: "course_code is required" });
    }
    if (!courseName || !String(courseName).trim()) {
      return res.status(400).json({ success: false, message: "course_name is required" });
    }

    const duration = Number.parseInt(examDurationMinutes, 10);
    if (Number.isNaN(duration) || duration < 15) {
      return res.status(400).json({ success: false, message: "exam_duration_minutes must be a number ≥ 15" });
    }

    const result = await pool.query(
      `UPDATE courses
       SET course_code = $1, course_name = $2, exam_duration_minutes = $3, is_active = $4
       WHERE id = $5 AND owner_id = $6
       RETURNING id, course_code, course_name, exam_duration_minutes, student_count_cache, is_active`,
      [String(courseCode).trim(), String(courseName).trim(), duration, Boolean(isActive), req.params.id, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    res.json({ success: true, message: "Course updated successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Error updating course:", error.message);
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "Course code already exists" });
    }
    res.status(500).json({ success: false, message: "Failed to update course" });
  }
});

// DELETE /api/courses/:id
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM courses WHERE id = $1 AND owner_id = $2 RETURNING id, course_code`,
      [req.params.id, req.user.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    res.json({ success: true, message: "Course deleted successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Error deleting course:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete course" });
  }
});

export default router;
