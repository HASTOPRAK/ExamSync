import express from "express";
import {
  registerTeacher,
  registerStudent,
  login,
  getMe,
  googleAuth,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

router.post("/register/teacher", authLimiter, registerTeacher);
router.post("/register/student", authLimiter, registerStudent);
router.post("/login", authLimiter, login);
router.post("/google", authLimiter, googleAuth);
router.get("/me", authenticate, getMe);

export default router;
