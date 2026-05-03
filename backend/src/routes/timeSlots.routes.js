import express from "express";
import {
  getAllTimeSlots,
  getTimeSlotById,
  getTimeSlotsByExamPeriod,
  createTimeSlot,
  updateTimeSlot,
  toggleTimeSlotActive,
  deleteTimeSlot,
  clearTimeSlotsByExamPeriod,
  generateTimeSlots,
} from "../controllers/timeSlots.controller.js";

const router = express.Router();

router.get("/", getAllTimeSlots);
router.get("/exam-period/:examPeriodId", getTimeSlotsByExamPeriod);
router.get("/:id", getTimeSlotById);

router.post("/", createTimeSlot);
router.post("/generate", generateTimeSlots);

router.put("/:id", updateTimeSlot);
router.patch("/:id/toggle-active", toggleTimeSlotActive);

router.delete("/:id", deleteTimeSlot);
router.delete("/exam-period/:examPeriodId", clearTimeSlotsByExamPeriod);

export default router;
