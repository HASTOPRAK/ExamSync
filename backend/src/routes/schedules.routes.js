import express from "express";
import {
  generateSchedule,
  getReport,
  resetSchedule,
  listDemoPresets,
  seedDemo,
} from "../controllers/schedules.controller.js";

const router = express.Router();

router.post("/generate", generateSchedule);
router.get("/:examPeriodId/report", getReport);
router.post("/:examPeriodId/reset", resetSchedule);

// Demo data seeding (for testing the scheduling engine)
router.get("/demo/presets", listDemoPresets);
router.post("/demo/seed", seedDemo);

export default router;
