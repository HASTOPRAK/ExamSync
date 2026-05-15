import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import pool from "../config/db.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const SALT_ROUNDS = 12;
const STUDENT_NO_REGEX = /^\d{4}[1-4][12]\d{3}$/; // YYYY C E NNN
const STUDENT_EMAIL_DOMAIN = "ogr.edu.tr";

function validatePassword(password) {
  if (!password || password.length < 8)      return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password))               return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password))               return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(password))               return "Password must contain at least one number";
  return null; // valid
}

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
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ success: false, message: pwError });

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const userResult = await pool.query(
      `INSERT INTO users (email, full_name, password_hash, role)
       VALUES ($1, $2, $3, 'teacher')
       RETURNING id, email, full_name, role, created_at`,
      [normalizedEmail, String(full_name).trim(), passwordHash],
    );
    const user = userResult.rows[0];

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: "Teacher registered successfully",
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      profile: null,
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
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ success: false, message: pwError });

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
      `SELECT u.id, u.email, u.full_name, u.password_hash, u.role, u.is_active,
              s.id AS s_id, s.student_no, s.full_name AS s_full_name,
              s.class_no, s.education_type, s.semester_no, s.department_id AS s_dept_id
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       WHERE u.email = $1`,
      [normalizedEmail],
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const row = userResult.rows[0];
    const user = { id: row.id, email: row.email, full_name: row.full_name, password_hash: row.password_hash, role: row.role, is_active: row.is_active };

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
    }

    return res.status(200).json({
      success: true,
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
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
      `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.created_at, u.last_login_at,
              s.id AS s_id, s.student_no, s.full_name AS s_full_name,
              s.class_no, s.education_type, s.semester_no, s.department_id AS s_dept_id
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
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
    }

    return res.status(200).json({
      success: true,
      user: { id: row.id, email: row.email, full_name: row.full_name, role: row.role, created_at: row.created_at, last_login_at: row.last_login_at },
      profile,
    });
  } catch (error) {
    console.error("GetMe error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch user", error: error.message });
  }
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────
// POST /api/auth/google
// Body: { credential }  — the ID token returned by the Google button
async function googleAuth(req, res) {
  try {
    const { credential } = req.body ?? {};

    if (!credential) {
      return res.status(400).json({ success: false, message: "credential is required" });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ success: false, message: "Google OAuth is not configured on this server" });
    }

    // Verify the ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;

    if (!email) {
      return res.status(400).json({ success: false, message: "Google account has no email" });
    }

    const normalizedEmail = email.toLowerCase();

    // Find existing user by google_id or email
    const existing = await pool.query(
      `SELECT id, email, full_name, role, google_id, is_active FROM users
       WHERE google_id = $1 OR email = $2
       LIMIT 1`,
      [googleId, normalizedEmail],
    );

    let userId, userEmail, userName, userRole;

    if (existing.rows.length > 0) {
      const u = existing.rows[0];

      if (!u.is_active) {
        return res.status(403).json({ success: false, message: "Account is deactivated" });
      }

      // Link google_id if this was an email-only account
      if (!u.google_id) {
        await pool.query(
          `UPDATE users SET google_id = $1, last_login_at = NOW() WHERE id = $2`,
          [googleId, u.id],
        );
      } else {
        await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [u.id]);
      }

      userId    = u.id;
      userEmail = u.email;
      userName  = u.full_name;
      userRole  = u.role;
    } else {
      // New user — create teacher account only
      const newUserResult = await pool.query(
        `INSERT INTO users (email, full_name, password_hash, role, google_id, last_login_at)
         VALUES ($1, $2, NULL, 'teacher', $3, NOW())
         RETURNING id, email, full_name, role`,
        [normalizedEmail, name || null, googleId],
      );
      const newUser = newUserResult.rows[0];

      userId    = newUser.id;
      userEmail = newUser.email;
      userName  = newUser.full_name;
      userRole  = newUser.role;
    }

    // Fetch student profile if applicable
    let profile = null;
    if (userRole === "student") {
      const stuResult = await pool.query(
        `SELECT id, student_no, full_name, class_no, education_type, semester_no, department_id
         FROM students WHERE user_id = $1 LIMIT 1`,
        [userId],
      );
      if (stuResult.rows.length > 0) {
        const s = stuResult.rows[0];
        profile = { id: s.id, student_no: s.student_no, full_name: s.full_name, class_no: s.class_no, education_type: s.education_type, semester_no: s.semester_no, department_id: s.department_id };
      }
    }

    const token = signToken({ id: userId, email: userEmail, role: userRole });

    return res.status(200).json({
      success: true,
      token,
      user: { id: userId, email: userEmail, full_name: userName, role: userRole },
      profile,
    });
  } catch (error) {
    console.error("Google auth error:", error.message);
    if (error.message?.includes("Token used too late") || error.message?.includes("Invalid token signature")) {
      return res.status(401).json({ success: false, message: "Invalid or expired Google token" });
    }
    return res.status(500).json({ success: false, message: "Google authentication failed" });
  }
}

export { registerTeacher, registerStudent, login, getMe, googleAuth };
