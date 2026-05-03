import express from "express";
import authRoutes from "./auth.routes.js";
import studentRoutes from "./students.routes.js";
import courseRoutes from "./courses.routes.js";
import roomRoutes from "./rooms.routes.js";
import examPeriodRoutes from "./examPeriods.routes.js";
import timeSlotRoutes from "./timeSlots.routes.js";
import examRoutes from "./exams.routes.js";
import validationRoutes from "./validation.routes.js";
import schedulesRoutes from "./schedules.routes.js";
import importRoutes from "./imports.routes.js";
import instructorRoutes from "./instructors.routes.js";
import courseInstructorRoutes from "./courseInstructors.routes.js";
import { authenticate, requireRole } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public — no token required
router.use("/auth", authRoutes);

// All routes below require a valid JWT
router.use(authenticate);

// Students: teachers/admins manage; students can read (own schedule handled inside controller)
router.use("/students", studentRoutes);
router.use("/courses", courseRoutes);
router.use("/rooms", roomRoutes);
router.use("/exam-periods", examPeriodRoutes);
router.use("/time-slots", timeSlotRoutes);
router.use("/exams", examRoutes);
router.use("/validation", validationRoutes);
router.use("/schedules", schedulesRoutes);
router.use("/imports", importRoutes);
router.use("/instructors", instructorRoutes);
router.use("/course-instructors", courseInstructorRoutes);

export default router;
