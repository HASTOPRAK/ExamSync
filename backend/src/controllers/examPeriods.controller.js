import pool from "../config/db.js";

function isValidDate(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

async function getAllExamPeriods(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        academic_year,
        term,
        exam_type,
        start_date,
        end_date,
        status,
        created_at,
        updated_at
      FROM exam_periods
      ORDER BY created_at DESC, id DESC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get exam periods error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch exam periods",
      error: error.message,
    });
  }
}

async function getExamPeriodById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        academic_year,
        term,
        exam_type,
        start_date,
        end_date,
        status,
        created_at,
        updated_at
      FROM exam_periods
      WHERE id = $1
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Exam period not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get exam period by id error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch exam period",
      error: error.message,
    });
  }
}

async function createExamPeriod(req, res) {
  try {
    const {
      name,
      academic_year: academicYear,
      term,
      exam_type: examType,
      start_date: startDate,
      end_date: endDate,
      status = "draft",
    } = req.body ?? {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "name is required",
      });
    }

    if (!academicYear || !String(academicYear).trim()) {
      return res.status(400).json({
        success: false,
        message: "academic_year is required",
      });
    }

    if (!term || !String(term).trim()) {
      return res.status(400).json({
        success: false,
        message: "term is required",
      });
    }

    if (!examType || !String(examType).trim()) {
      return res.status(400).json({
        success: false,
        message: "exam_type is required",
      });
    }

    if (!startDate || !isValidDate(startDate)) {
      return res.status(400).json({
        success: false,
        message: "start_date must be a valid date",
      });
    }

    if (!endDate || !isValidDate(endDate)) {
      return res.status(400).json({
        success: false,
        message: "end_date must be a valid date",
      });
    }

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: "end_date must be after start_date",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO exam_periods (
        name,
        academic_year,
        term,
        exam_type,
        start_date,
        end_date,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        name,
        academic_year,
        term,
        exam_type,
        start_date,
        end_date,
        status,
        created_at,
        updated_at
      `,
      [
        String(name).trim(),
        String(academicYear).trim(),
        String(term).trim(),
        String(examType).trim(),
        startDate,
        endDate,
        String(status).trim(),
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Exam period created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create exam period error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create exam period",
      error: error.message,
    });
  }
}

async function updateExamPeriod(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      academic_year: academicYear,
      term,
      exam_type: examType,
      start_date: startDate,
      end_date: endDate,
      status = "draft",
    } = req.body ?? {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "name is required",
      });
    }

    if (!academicYear || !String(academicYear).trim()) {
      return res.status(400).json({
        success: false,
        message: "academic_year is required",
      });
    }

    if (!term || !String(term).trim()) {
      return res.status(400).json({
        success: false,
        message: "term is required",
      });
    }

    if (!examType || !String(examType).trim()) {
      return res.status(400).json({
        success: false,
        message: "exam_type is required",
      });
    }

    if (!startDate || !isValidDate(startDate)) {
      return res.status(400).json({
        success: false,
        message: "start_date must be a valid date",
      });
    }

    if (!endDate || !isValidDate(endDate)) {
      return res.status(400).json({
        success: false,
        message: "end_date must be a valid date",
      });
    }

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: "end_date must be after start_date",
      });
    }

    const result = await pool.query(
      `
      UPDATE exam_periods
      SET
        name = $1,
        academic_year = $2,
        term = $3,
        exam_type = $4,
        start_date = $5,
        end_date = $6,
        status = $7,
        updated_at = NOW()
      WHERE id = $8
      RETURNING
        id,
        name,
        academic_year,
        term,
        exam_type,
        start_date,
        end_date,
        status,
        created_at,
        updated_at
      `,
      [
        String(name).trim(),
        String(academicYear).trim(),
        String(term).trim(),
        String(examType).trim(),
        startDate,
        endDate,
        String(status).trim(),
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Exam period not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Exam period updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update exam period error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update exam period",
      error: error.message,
    });
  }
}

async function updateExamPeriodStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};

    if (!status || !String(status).trim()) {
      return res.status(400).json({
        success: false,
        message: "status is required",
      });
    }

    const result = await pool.query(
      `
      UPDATE exam_periods
      SET
        status = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        name,
        academic_year,
        term,
        exam_type,
        start_date,
        end_date,
        status,
        created_at,
        updated_at
      `,
      [String(status).trim(), id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Exam period not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Exam period status updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update exam period status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update exam period status",
      error: error.message,
    });
  }
}

async function deleteExamPeriod(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM exam_periods
      WHERE id = $1
      RETURNING id, name
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Exam period not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Exam period deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Delete exam period error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete exam period",
      error: error.message,
    });
  }
}

export {
  getAllExamPeriods,
  getExamPeriodById,
  createExamPeriod,
  updateExamPeriod,
  updateExamPeriodStatus,
  deleteExamPeriod,
};
