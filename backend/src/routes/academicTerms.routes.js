import express from "express";
import {
  getAcademicTerms,
  createAcademicTerm,
  updateAcademicTerm,
  deleteAcademicTerm,
} from "../controllers/academicTerms.controller.js";

const router = express.Router();

router.get("/",        getAcademicTerms);
router.post("/",       createAcademicTerm);
router.put("/:id",     updateAcademicTerm);
router.delete("/:id",  deleteAcademicTerm);

export default router;
