import express from "express";
import {
  getAllExamPeriods,
  getExamPeriodById,
  createExamPeriod,
  updateExamPeriod,
  updateExamPeriodStatus,
  deleteExamPeriod,
} from "../controllers/examPeriods.controller.js";

const router = express.Router();

router.get("/", getAllExamPeriods);
router.get("/:id", getExamPeriodById);
router.post("/", createExamPeriod);
router.put("/:id", updateExamPeriod);
router.patch("/:id/status", updateExamPeriodStatus);
router.delete("/:id", deleteExamPeriod);

export default router;
