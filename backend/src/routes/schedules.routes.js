import express from "express";
import {
  generateSchedule,
  getReport,
  resetSchedule,
} from "../controllers/schedules.controller.js";

const router = express.Router();

router.post("/generate", generateSchedule);
router.get("/:examPeriodId/report", getReport);
router.post("/:examPeriodId/reset", resetSchedule);

export default router;
