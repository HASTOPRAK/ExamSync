import jwt from "jsonwebtoken";

/**
 * Verify the JWT in the Authorization header and attach the decoded
 * payload to req.user.  Responds 401 if the token is missing/invalid.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, role }
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

/**
 * Factory that returns a middleware allowing only the listed roles.
 * Must be placed after authenticate().
 *
 * Usage:  router.post("/", authenticate, requireRole("teacher","admin"), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: insufficient permissions",
      });
    }
    next();
  };
}

export { authenticate, requireRole };
