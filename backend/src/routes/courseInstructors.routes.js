import express from "express";
import {
  getAssignmentsByCourse,
  assignInstructorToCourse,
  removeInstructorFromCourse,
} from "../controllers/courseInstructors.controller.js";

const router = express.Router();

router.get("/course/:courseId", getAssignmentsByCourse);
router.post("/", assignInstructorToCourse);
router.delete(
  "/course/:courseId/instructor/:instructorId",
  removeInstructorFromCourse,
);

export default router;
