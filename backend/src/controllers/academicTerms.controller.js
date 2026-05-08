import pool from "../config/db.js";

async function getAcademicTerms(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, academic_year, term, semester_start, semester_end, created_at, updated_at
       FROM academic_terms
       WHERE owner_id = $1
       ORDER BY semester_start DESC`,
      [req.user.id],
    );
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get academic terms error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch academic terms" });
  }
}

async function createAcademicTerm(req, res) {
  const { academic_year, term, semester_start, semester_end } = req.body;

  if (!academic_year || !term || !semester_start || !semester_end) {
    return res.status(400).json({ success: false, message: "academic_year, term, semester_start, and semester_end are required" });
  }

  const start = new Date(semester_start);
  const end   = new Date(semester_end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return res.status(400).json({ success: false, message: "Invalid date format" });
  }
  if (start >= end) {
    return res.status(400).json({ success: false, message: "semester_start must be before semester_end" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO academic_terms (owner_id, academic_year, term, semester_start, semester_end)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (owner_id, academic_year, term)
         DO UPDATE SET semester_start = EXCLUDED.semester_start,
                       semester_end   = EXCLUDED.semester_end,
                       updated_at     = NOW()
       RETURNING id, academic_year, term, semester_start, semester_end, created_at, updated_at`,
      [req.user.id, academic_year.trim(), term.trim(), semester_start, semester_end],
    );
    return res.status(201).json({ success: true, data: result.rows[0], message: "Academic term saved" });
  } catch (error) {
    console.error("Create academic term error:", error);
    return res.status(500).json({ success: false, message: "Failed to save academic term" });
  }
}

async function updateAcademicTerm(req, res) {
  const { id } = req.params;
  const { academic_year, term, semester_start, semester_end } = req.body;

  if (!academic_year || !term || !semester_start || !semester_end) {
    return res.status(400).json({ success: false, message: "academic_year, term, semester_start, and semester_end are required" });
  }

  const start = new Date(semester_start);
  const end   = new Date(semester_end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return res.status(400).json({ success: false, message: "Invalid date format" });
  }
  if (start >= end) {
    return res.status(400).json({ success: false, message: "semester_start must be before semester_end" });
  }

  try {
    const result = await pool.query(
      `UPDATE academic_terms
       SET academic_year = $1, term = $2, semester_start = $3, semester_end = $4, updated_at = NOW()
       WHERE id = $5 AND owner_id = $6
       RETURNING id, academic_year, term, semester_start, semester_end, created_at, updated_at`,
      [academic_year.trim(), term.trim(), semester_start, semester_end, id, req.user.id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Academic term not found" });
    }
    return res.status(200).json({ success: true, data: result.rows[0], message: "Academic term updated" });
  } catch (error) {
    console.error("Update academic term error:", error);
    return res.status(500).json({ success: false, message: "Failed to update academic term" });
  }
}

async function deleteAcademicTerm(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM academic_terms WHERE id = $1 AND owner_id = $2 RETURNING id`,
      [id, req.user.id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Academic term not found" });
    }
    return res.status(200).json({ success: true, message: "Academic term deleted" });
  } catch (error) {
    console.error("Delete academic term error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete academic term" });
  }
}

export { getAcademicTerms, createAcademicTerm, updateAcademicTerm, deleteAcademicTerm };
