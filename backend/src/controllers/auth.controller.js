import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const SALT_ROUNDS = 12;
const STUDENT_NO_REGEX = /^\d{4}[1-4][12]\d{3}$/; // YYYY C E NNN
const STUDENT_EMAIL_DOMAIN = "ogr.edu.tr";

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" },
  );
}

// ─── Teacher / Admin Register ─────────────────────────────────────────────────
// POST /api/auth/register/teacher
// Body: { full_name, email, password }
async function registerTeacher(req, res) {
  try {
    const { full_name, email, password } = req.body ?? {};

    if (!full_name || !String(full_name).trim()) {
      return res.status(400).json({ success: false, message: "full_name is required" });
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, message: "email is required" });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: "password must be at least 8 characters" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const client = await pool.connect();
    let user, profile;
    try {
      await client.query("BEGIN");

      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, 'teacher')
         RETURNING id, email, role, created_at`,
        [normalizedEmail, passwordHash],
      );
      user = userResult.rows[0];

      // Try to link an existing instructor record with the same email first
      // (e.g. admin imported them before they registered)
      const existing = await client.query(
        `SELECT id FROM instructors WHERE email = $1 AND user_id IS NULL LIMIT 1`,
        [normalizedEmail],
      );

      if (existing.rows.length > 0) {
        const linked = await client.query(
          `UPDATE instructors SET user_id = $1 WHERE id = $2
           RETURNING id, full_name, department_id`,
          [user.id, existing.rows[0].id],
        );
        profile = linked.rows[0] ?? null;
      } else {
        // Create a new instructor profile for this teacher
        // department_id is nullable after migration 003
        const created = await client.query(
          `INSERT INTO instructors (full_name, email, user_id, owner_id)
           VALUES ($1, $2, $3, $4)
           RETURNING id, full_name, department_id`,
          [String(full_name).trim(), normalizedEmail, user.id, user.id],
        );
        profile = created.rows[0] ?? null;
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: "Teacher registered successfully",
      token,
      user: { id: user.id, email: user.email, role: user.role },
      profile,
    });
  } catch (error) {
    console.error("Teacher register error:", error);
    return res.status(500).json({ success: false, message: "Registration failed", error: error.message });
  }
}

// ─── Student Register ─────────────────────────────────────────────────────────
// POST /api/auth/register/student
// Body: { student_no, password }
// The email is generated automatically: {student_no}@ogr.edu.tr
// The student_no must already exist in the students table (imported by admin).
async function registerStudent(req, res) {
  try {
    const { student_no, password } = req.body ?? {};

    if (!student_no || !STUDENT_NO_REGEX.test(String(student_no).trim())) {
      return res.status(400).json({
        success: false,
        message: "Invalid student number. Expected format: YYYYCENNN (e.g. 202631009)",
      });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: "password must be at least 8 characters" });
    }

    const normalizedNo = String(student_no).trim();
    const email = `${normalizedNo}@${STUDENT_EMAIL_DOMAIN}`;

    const studentResult = await pool.query(
      "SELECT id, full_name, user_id FROM students WHERE student_no = $1",
      [normalizedNo],
    );
    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student number not found. Contact your institution.",
      });
    }

    const student = studentResult.rows[0];

    if (student.user_id) {
      return res.status(409).json({ success: false, message: "This student account is already registered" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Account already exists for this student number" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, 'student')
         RETURNING id, email, role, created_at`,
        [email, passwordHash],
      );
      const user = userResult.rows[0];

      await client.query(
        "UPDATE students SET user_id = $1, email = $2 WHERE id = $3",
        [user.id, email, student.id],
      );

      await client.query("COMMIT");

      const token = signToken(user);

      return res.status(201).json({
        success: true,
        message: "Student registered successfully",
        token,
        user: { id: user.id, email: user.email, role: user.role },
        student: { id: student.id, full_name: student.full_name, student_no: normalizedNo },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Student register error:", error);
    return res.status(500).json({ success: false, message: "Registration failed", error: error.message });
  }
}

// ─── Login (both roles) ───────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
async function login(req, res) {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const userResult = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.role, u.is_active,
              s.id AS s_id, s.student_no, s.full_name AS s_full_name,
              s.class_no, s.education_type, s.semester_no, s.department_id AS s_dept_id,
              i.id AS i_id, i.full_name AS i_full_name, i.department_id AS i_dept_id
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN instructors i ON i.user_id = u.id
       WHERE u.email = $1`,
      [normalizedEmail],
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const row = userResult.rows[0];
    const user = { id: row.id, email: row.email, password_hash: row.password_hash, role: row.role, is_active: row.is_active };

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: "Account is deactivated" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

    const token = signToken(user);

    let profile = null;
    if (user.role === "student" && row.s_id) {
      profile = { id: row.s_id, student_no: row.student_no, full_name: row.s_full_name, class_no: row.class_no, education_type: row.education_type, semester_no: row.semester_no, department_id: row.s_dept_id };
    } else if (row.i_id) {
      profile = { id: row.i_id, full_name: row.i_full_name, department_id: row.i_dept_id };
    }

    return res.status(200).json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role },
      profile,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Login failed", error: error.message });
  }
}

// ─── Get Current User ─────────────────────────────────────────────────────────
// GET /api/auth/me   (requires authenticate middleware)
async function getMe(req, res) {
  try {
    const userResult = await pool.query(
      `SELECT u.id, u.email, u.role, u.is_active, u.created_at, u.last_login_at,
              s.id AS s_id, s.student_no, s.full_name AS s_full_name,
              s.class_no, s.education_type, s.semester_no, s.department_id AS s_dept_id,
              i.id AS i_id, i.full_name AS i_full_name, i.department_id AS i_dept_id
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       LEFT JOIN instructors i ON i.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const row = userResult.rows[0];

    let profile = null;
    if (row.role === "student" && row.s_id) {
      profile = { id: row.s_id, student_no: row.student_no, full_name: row.s_full_name, class_no: row.class_no, education_type: row.education_type, semester_no: row.semester_no, department_id: row.s_dept_id };
    } else if (row.i_id) {
      profile = { id: row.i_id, full_name: row.i_full_name, department_id: row.i_dept_id };
    }

    return res.status(200).json({
      success: true,
      user: { id: row.id, email: row.email, role: row.role, created_at: row.created_at, last_login_at: row.last_login_at },
      profile,
    });
  } catch (error) {
    console.error("GetMe error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch user", error: error.message });
  }
}

export { registerTeacher, registerStudent, login, getMe };
