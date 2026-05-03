import pool from "../config/db.js";

async function getAllExams(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        e.id,
        e.course_id,
        c.course_code,
        c.course_name,
        e.exam_period_id,
        ep.name AS exam_period_name,
        e.time_slot_id,
        ts.slot_date,
        ts.start_time,
        ts.end_time,
        e.primary_instructor_id,
        i.full_name AS primary_instructor_name,
        e.status,
        e.notes,
        e.created_at,
        e.updated_at
      FROM exams e
      JOIN courses c ON c.id = e.course_id
      JOIN exam_periods ep ON ep.id = e.exam_period_id
      LEFT JOIN time_slots ts ON ts.id = e.time_slot_id
      LEFT JOIN instructors i ON i.id = e.primary_instructor_id
      ORDER BY c.course_code ASC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get exams error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch exams",
      error: error.message,
    });
  }
}

async function getExamsByExamPeriod(req, res) {
  try {
    const { examPeriodId } = req.params;

    const result = await pool.query(
      `
      SELECT
        e.id,
        e.course_id,
        c.course_code,
        c.course_name,
        e.exam_period_id,
        e.time_slot_id,
        ts.slot_date,
        ts.start_time,
        ts.end_time,
        e.primary_instructor_id,
        i.full_name AS primary_instructor_name,
        e.status,
        e.notes,
        e.created_at,
        e.updated_at
      FROM exams e
      JOIN courses c ON c.id = e.course_id
      LEFT JOIN time_slots ts ON ts.id = e.time_slot_id
      LEFT JOIN instructors i ON i.id = e.primary_instructor_id
      WHERE e.exam_period_id = $1
      ORDER BY c.course_code ASC
      `,
      [examPeriodId],
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get exams by exam period error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch exams for exam period",
      error: error.message,
    });
  }
}

async function getExamById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        e.id,
        e.course_id,
        c.course_code,
        c.course_name,
        e.exam_period_id,
        ep.name AS exam_period_name,
        e.time_slot_id,
        ts.slot_date,
        ts.start_time,
        ts.end_time,
        e.primary_instructor_id,
        i.full_name AS primary_instructor_name,
        e.status,
        e.notes,
        e.created_at,
        e.updated_at
      FROM exams e
      JOIN courses c ON c.id = e.course_id
      JOIN exam_periods ep ON ep.id = e.exam_period_id
      LEFT JOIN time_slots ts ON ts.id = e.time_slot_id
      LEFT JOIN instructors i ON i.id = e.primary_instructor_id
      WHERE e.id = $1
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Exam not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get exam by id error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch exam",
      error: error.message,
    });
  }
}

async function updateExam(req, res) {
  try {
    const { id } = req.params;
    const {
      time_slot_id: timeSlotId = null,
      primary_instructor_id: primaryInstructorId = null,
      status = "scheduled",
      notes = null,
    } = req.body ?? {};

    const result = await pool.query(
      `
      UPDATE exams
      SET
        time_slot_id = $1,
        primary_instructor_id = $2,
        status = $3,
        notes = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING
        id,
        course_id,
        exam_period_id,
        time_slot_id,
        primary_instructor_id,
        status,
        notes,
        created_at,
        updated_at
      `,
      [
        timeSlotId ? Number(timeSlotId) : null,
        primaryInstructorId ? Number(primaryInstructorId) : null,
        String(status).trim(),
        notes ? String(notes).trim() : null,
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Exam not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Exam updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update exam error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update exam",
      error: error.message,
    });
  }
}

async function deleteExam(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM exams
      WHERE id = $1
      RETURNING id, course_id, exam_period_id
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Exam not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Exam deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Delete exam error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete exam",
      error: error.message,
    });
  }
}

export {
  getAllExams,
  getExamsByExamPeriod,
  getExamById,
  updateExam,
  deleteExam,
};
