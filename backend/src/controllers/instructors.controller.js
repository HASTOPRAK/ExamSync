import pool from "../config/db.js";

async function getAllInstructors(req, res) {
  try {
    const { type } = req.query;
    const params = [req.user.id];
    let query = `SELECT id, full_name, email, department_id, instructor_type, is_available, created_at, updated_at
       FROM instructors
       WHERE owner_id = $1`;

    if (type === "faculty" || type === "assistant") {
      params.push(type);
      query += ` AND instructor_type = $2`;
    }

    query += ` ORDER BY instructor_type ASC, full_name ASC`;

    const result = await pool.query(query, params);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get instructors error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch instructors", error: error.message });
  }
}

async function getInstructorById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, full_name, email, department_id, instructor_type, is_available, created_at, updated_at
       FROM instructors
       WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Instructor not found" });
    }
    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Get instructor by id error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch instructor", error: error.message });
  }
}

async function createInstructor(req, res) {
  try {
    const {
      full_name: fullName,
      email = null,
      department_id: departmentId = 1,
      instructor_type: instructorType = "faculty",
    } = req.body ?? {};

    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ success: false, message: "full_name is required" });
    }
    if (!["faculty", "assistant"].includes(instructorType)) {
      return res.status(400).json({ success: false, message: "instructor_type must be 'faculty' or 'assistant'" });
    }

    const result = await pool.query(
      `INSERT INTO instructors (full_name, email, department_id, instructor_type, owner_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, department_id, instructor_type, is_available, created_at, updated_at`,
      [String(fullName).trim(), email ? String(email).trim() : null, Number(departmentId), instructorType, req.user.id],
    );

    return res.status(201).json({ success: true, message: "Instructor created successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Create instructor error:", error);
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "Instructor email already exists" });
    }
    return res.status(500).json({ success: false, message: "Failed to create instructor", error: error.message });
  }
}

async function updateInstructor(req, res) {
  try {
    const { id } = req.params;
    const {
      full_name: fullName,
      email = null,
      department_id: departmentId = 1,
      instructor_type: instructorType = "faculty",
    } = req.body ?? {};

    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ success: false, message: "full_name is required" });
    }
    if (!["faculty", "assistant"].includes(instructorType)) {
      return res.status(400).json({ success: false, message: "instructor_type must be 'faculty' or 'assistant'" });
    }

    const result = await pool.query(
      `UPDATE instructors
       SET full_name = $1, email = $2, department_id = $3, instructor_type = $4, updated_at = NOW()
       WHERE id = $5 AND owner_id = $6
       RETURNING id, full_name, email, department_id, instructor_type, is_available, created_at, updated_at`,
      [String(fullName).trim(), email ? String(email).trim() : null, Number(departmentId), instructorType, id, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Instructor not found" });
    }
    return res.status(200).json({ success: true, message: "Instructor updated successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Update instructor error:", error);
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "Instructor email already exists" });
    }
    return res.status(500).json({ success: false, message: "Failed to update instructor", error: error.message });
  }
}

async function deleteInstructor(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM instructors WHERE id = $1 AND owner_id = $2 RETURNING id, full_name`,
      [id, req.user.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Instructor not found" });
    }
    return res.status(200).json({ success: true, message: "Instructor deleted successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Delete instructor error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete instructor", error: error.message });
  }
}

export {
  getAllInstructors,
  getInstructorById,
  createInstructor,
  updateInstructor,
  deleteInstructor,
};
