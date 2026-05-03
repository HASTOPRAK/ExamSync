import pool from "../config/db.js";

async function getAllInstructors(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        id,
        full_name,
        email,
        department_id,
        created_at,
        updated_at
      FROM instructors
      ORDER BY full_name ASC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get instructors error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch instructors",
      error: error.message,
    });
  }
}

async function getInstructorById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        full_name,
        email,
        department_id,
        created_at,
        updated_at
      FROM instructors
      WHERE id = $1
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get instructor by id error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch instructor",
      error: error.message,
    });
  }
}

async function createInstructor(req, res) {
  try {
    const {
      full_name: fullName,
      email = null,
      department_id: departmentId = 1,
    } = req.body ?? {};

    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({
        success: false,
        message: "full_name is required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO instructors (full_name, email, department_id)
      VALUES ($1, $2, $3)
      RETURNING
        id,
        full_name,
        email,
        department_id,
        created_at,
        updated_at
      `,
      [
        String(fullName).trim(),
        email ? String(email).trim() : null,
        Number(departmentId),
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Instructor created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create instructor error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Instructor email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create instructor",
      error: error.message,
    });
  }
}

async function updateInstructor(req, res) {
  try {
    const { id } = req.params;
    const {
      full_name: fullName,
      email = null,
      department_id: departmentId = 1,
    } = req.body ?? {};

    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({
        success: false,
        message: "full_name is required",
      });
    }

    const result = await pool.query(
      `
      UPDATE instructors
      SET
        full_name = $1,
        email = $2,
        department_id = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING
        id,
        full_name,
        email,
        department_id,
        created_at,
        updated_at
      `,
      [
        String(fullName).trim(),
        email ? String(email).trim() : null,
        Number(departmentId),
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Instructor updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update instructor error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Instructor email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update instructor",
      error: error.message,
    });
  }
}

async function deleteInstructor(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM instructors
      WHERE id = $1
      RETURNING id, full_name
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Instructor deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Delete instructor error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete instructor",
      error: error.message,
    });
  }
}

export {
  getAllInstructors,
  getInstructorById,
  createInstructor,
  updateInstructor,
  deleteInstructor,
};
