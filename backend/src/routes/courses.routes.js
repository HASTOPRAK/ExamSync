import express from "express";
import pool from "../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, course_code, course_name, exam_duration_minutes, student_count_cache
      FROM courses
      ORDER BY id
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching courses:", error.message);
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

export default router;
