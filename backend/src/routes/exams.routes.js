import express from "express";
import {
  getAllExams,
  getExamsByExamPeriod,
  getExamById,
  updateExam,
  deleteExam,
} from "../controllers/exams.controller.js";

const router = express.Router();

router.get("/", getAllExams);
router.get("/exam-period/:examPeriodId", getExamsByExamPeriod);
router.get("/:id", getExamById);
router.put("/:id", updateExam);
router.delete("/:id", deleteExam);

export default router;
