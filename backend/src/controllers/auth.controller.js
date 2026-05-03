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

    // Check email not already taken
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, 'teacher')
         RETURNING id, email, role, created_at`,
        [normalizedEmail, passwordHash],
      );
      const user = userResult.rows[0];

      // Create or link instructor record
      const instrResult = await client.query(
        `INSERT INTO instructors (full_name, email, department_id, user_id)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING id, full_name, email`,
        [String(full_name).trim(), normalizedEmail, user.id],
      );

      await client.query("COMMIT");

      const token = signToken(user);

      return res.status(201).json({
        success: true,
        message: "Teacher registered successfully",
        token,
        user: { id: user.id, email: user.email, role: user.role },
        instructor: instrResult.rows[0],
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
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

    // Student must already exist in the DB (imported by a teacher/admin)
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

    // Check email uniqueness on users (safety guard)
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

      // Link user to student record and set the generated email
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
      "SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1",
      [normalizedEmail],
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: "Account is deactivated" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    // Update last login timestamp
    await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

    const token = signToken(user);

    // Fetch profile depending on role
    let profile = null;
    if (user.role === "student") {
      const s = await pool.query(
        `SELECT id, student_no, full_name, class_no, education_type, semester_no, department_id
         FROM students WHERE user_id = $1`,
        [user.id],
      );
      profile = s.rows[0] ?? null;
    } else {
      const i = await pool.query(
        "SELECT id, full_name, department_id FROM instructors WHERE user_id = $1",
        [user.id],
      );
      profile = i.rows[0] ?? null;
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
      "SELECT id, email, role, is_active, created_at, last_login_at FROM users WHERE id = $1",
      [req.user.id],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = userResult.rows[0];

    let profile = null;
    if (user.role === "student") {
      const s = await pool.query(
        `SELECT id, student_no, full_name, class_no, education_type, semester_no, department_id
         FROM students WHERE user_id = $1`,
        [user.id],
      );
      profile = s.rows[0] ?? null;
    } else {
      const i = await pool.query(
        "SELECT id, full_name, department_id FROM instructors WHERE user_id = $1",
        [user.id],
      );
      profile = i.rows[0] ?? null;
    }

    return res.status(200).json({
      success: true,
      user: { id: user.id, email: user.email, role: user.role, created_at: user.created_at, last_login_at: user.last_login_at },
      profile,
    });
  } catch (error) {
    console.error("GetMe error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch user", error: error.message });
  }
}

export { registerTeacher, registerStudent, login, getMe };
