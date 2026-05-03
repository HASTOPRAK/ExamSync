import {
  generateSchedulePhaseOne,
  runFullScheduleGeneration,
  getScheduleReport,
} from "../services/scheduler/index.js";
import db from "../config/db.js";

async function generateSchedule(req, res) {
  try {
    const { examPeriodId, phase = 5 } = req.body;

    if (!examPeriodId) {
      return res.status(400).json({
        success: false,
        message: "examPeriodId is required",
      });
    }

    let result;
    let message;

    if (Number(phase) === 1) {
      result = await generateSchedulePhaseOne(examPeriodId);
      message =
        "Phase 1 completed: scheduling data loaded and conflict graph built";
    } else {
      result = await runFullScheduleGeneration(examPeriodId);
      message = "Phase 5 completed: schedule generated, validated, and scored";
    }

    return res.status(200).json({
      success: true,
      message,
      data: result,
    });
  } catch (error) {
    console.error("generateSchedule error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate schedule",
      error: error.message,
    });
  }
}

async function getReport(req, res) {
  try {
    const { examPeriodId } = req.params;
    const result = await getScheduleReport(examPeriodId);

    return res.status(200).json({
      success: true,
      message: "Schedule report generated successfully",
      data: result,
    });
  } catch (error) {
    console.error("getReport error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate schedule report",
      error: error.message,
    });
  }
}

async function resetSchedule(req, res) {
  try {
    const { examPeriodId } = req.params;
    const client = await db.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
        DELETE FROM exam_room_assignments
        WHERE exam_id IN (
          SELECT id
          FROM exams
          WHERE exam_period_id = $1
        )
        `,
        [examPeriodId],
      );

      await client.query(
        `
        UPDATE exams
        SET
          time_slot_id = NULL,
          primary_instructor_id = NULL,
          status = 'draft'
        WHERE exam_period_id = $1
        `,
        [examPeriodId],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return res.status(200).json({
      success: true,
      message: "Schedule reset successfully",
    });
  } catch (error) {
    console.error("resetSchedule error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reset schedule",
      error: error.message,
    });
  }
}

export { generateSchedule, getReport, resetSchedule };

export default {
  generateSchedule,
  getReport,
  resetSchedule,
};
