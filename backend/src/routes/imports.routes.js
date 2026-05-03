import express from "express";
import uploadCsv from "../middlewares/uploadCsv.js";
import {
  buildTemplateCsv,
  previewEnrollmentImport,
  commitEnrollmentImport,
  buildStudentTemplateCsv,
  previewStudentImport,
  commitStudentImport,
} from "../services/imports/enrollmentImport.service.js";
import {
  generateDemoDataset,
  clearGeneratedDataset,
  generateDemoCourses,
  clearGeneratedCourses,
} from "../services/imports/demoDataset.service.js";
import {
  buildCourseTemplateCsv,
  previewCourseImport,
  commitCourseImport,
} from "../services/imports/courseImport.service.js";

const router = express.Router();

router.get("/templates/enrollments", (req, res) => {
  const csv = buildTemplateCsv();

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="enrollments_template.csv"',
  );

  return res.status(200).send(csv);
});

router.post(
  "/enrollments/preview",
  uploadCsv.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "CSV file is required",
        });
      }

      const result = await previewEnrollmentImport(req.file.buffer);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error("Enrollment preview import error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to preview enrollment import",
        error: error.message,
      });
    }
  },
);

router.post(
  "/enrollments/commit",
  uploadCsv.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "CSV file is required",
        });
      }

      const result = await commitEnrollmentImport(req.file.buffer);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error("Enrollment commit import error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to commit enrollment import",
        error: error.message,
      });
    }
  },
);

router.get("/templates/students", (req, res) => {
  const csv = buildStudentTemplateCsv();

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="students_template.csv"',
  );

  res.status(200).send(csv);
});

router.post("/students/preview", uploadCsv.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file required",
      });
    }

    const result = await previewStudentImport(req.file.buffer);

    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Student preview failed",
      error: err.message,
    });
  }
});

router.post("/students/commit", uploadCsv.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file required",
      });
    }

    const result = await commitStudentImport(req.file.buffer);

    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Student commit failed",
      error: err.message,
    });
  }
});

router.post("/dev/generate-dataset", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        message: "Demo dataset generation is disabled in production",
      });
    }

    const {
      studentCount = 300,
      minCoursesPerStudent = 4,
      maxCoursesPerStudent = 6,
      studentNoPrefix = "2026",
      courseCodePrefix = "",
      courseFilterMode = "all",
    } = req.body ?? {};

    const result = await generateDemoDataset({
      studentCount: Number(studentCount),
      minCoursesPerStudent: Number(minCoursesPerStudent),
      maxCoursesPerStudent: Number(maxCoursesPerStudent),
      studentNoPrefix: String(studentNoPrefix),
      courseCodePrefix: String(courseCodePrefix),
      courseFilterMode: String(courseFilterMode),
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Demo dataset generation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate demo dataset",
      error: error.message,
    });
  }
});

router.delete("/dev/clear-generated-data", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        message: "Dataset clearing disabled in production",
      });
    }

    const { studentNoPrefix = "2026" } = req.body ?? {};

    const result = await clearGeneratedDataset({
      studentNoPrefix: String(studentNoPrefix),
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Dataset clear error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to clear generated dataset",
      error: error.message,
    });
  }
});

router.post("/dev/generate-courses", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        message: "Demo course generation is disabled in production",
      });
    }

    const {
      courseCount = 20,
      courseCodePrefix = "TST",
      startNumber = 101,
      minDuration = 60,
      maxDuration = 90,
    } = req.body ?? {};

    const result = await generateDemoCourses({
      courseCount: Number(courseCount),
      courseCodePrefix: String(courseCodePrefix),
      startNumber: Number(startNumber),
      minDuration: Number(minDuration),
      maxDuration: Number(maxDuration),
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Demo course generation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate demo courses",
      error: error.message,
    });
  }
});

router.delete("/dev/clear-generated-courses", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        message: "Demo course clearing is disabled in production",
      });
    }

    const { courseCodePrefix = "TST" } = req.body ?? {};

    const result = await clearGeneratedCourses({
      courseCodePrefix: String(courseCodePrefix),
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Demo course clear error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to clear generated courses",
      error: error.message,
    });
  }
});

router.get("/templates/courses", (req, res) => {
  const csv = buildCourseTemplateCsv();

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="courses_template.csv"',
  );

  return res.status(200).send(csv);
});

router.post("/courses/preview", uploadCsv.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required",
      });
    }

    const result = await previewCourseImport(req.file.buffer);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Course preview import error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to preview course import",
      error: error.message,
    });
  }
});

router.post("/courses/commit", uploadCsv.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required",
      });
    }

    const result = await commitCourseImport(req.file.buffer);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Course commit import error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to commit course import",
      error: error.message,
    });
  }
});

export default router;
