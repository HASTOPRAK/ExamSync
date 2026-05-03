import pool from "../config/db.js";

async function getAssignmentsByCourse(req, res) {
  try {
    const { courseId } = req.params;

    const result = await pool.query(
      `SELECT
        ci.course_id,
        ci.instructor_id,
        c.course_code,
        c.course_name,
        i.full_name AS instructor_name,
        i.email AS instructor_email
       FROM course_instructors ci
       JOIN courses c ON c.id = ci.course_id
       JOIN instructors i ON i.id = ci.instructor_id
       WHERE ci.course_id = $1 AND c.owner_id = $2
       ORDER BY i.full_name ASC`,
      [courseId, req.user.id],
    );

    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get course assignments error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch course instructor assignments", error: error.message });
  }
}

async function assignInstructorToCourse(req, res) {
  try {
    const { course_id: courseId, instructor_id: instructorId } = req.body ?? {};

    if (!courseId || !instructorId) {
      return res.status(400).json({ success: false, message: "course_id and instructor_id are required" });
    }

    // Verify both course and instructor belong to this owner
    const [courseCheck, instructorCheck] = await Promise.all([
      pool.query(`SELECT id FROM courses WHERE id = $1 AND owner_id = $2`, [courseId, req.user.id]),
      pool.query(`SELECT id FROM instructors WHERE id = $1 AND owner_id = $2`, [instructorId, req.user.id]),
    ]);

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    if (instructorCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Instructor not found" });
    }

    const result = await pool.query(
      `INSERT INTO course_instructors (course_id, instructor_id)
       VALUES ($1, $2)
       ON CONFLICT (course_id, instructor_id) DO NOTHING
       RETURNING course_id, instructor_id`,
      [courseId, instructorId],
    );

    if (result.rows.length === 0) {
      return res.status(200).json({ success: true, message: "Assignment already exists" });
    }

    return res.status(201).json({ success: true, message: "Instructor assigned to course successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Assign instructor to course error:", error);
    return res.status(500).json({ success: false, message: "Failed to assign instructor to course", error: error.message });
  }
}

async function removeInstructorFromCourse(req, res) {
  try {
    const { courseId, instructorId } = req.params;

    // Verify course belongs to this owner
    const courseCheck = await pool.query(
      `SELECT id FROM courses WHERE id = $1 AND owner_id = $2`,
      [courseId, req.user.id],
    );
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    const result = await pool.query(
      `DELETE FROM course_instructors
       WHERE course_id = $1 AND instructor_id = $2
       RETURNING course_id, instructor_id`,
      [courseId, instructorId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    return res.status(200).json({ success: true, message: "Instructor removed from course successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Remove instructor from course error:", error);
    return res.status(500).json({ success: false, message: "Failed to remove instructor from course", error: error.message });
  }
}

export {
  getAssignmentsByCourse,
  assignInstructorToCourse,
  removeInstructorFromCourse,
};
