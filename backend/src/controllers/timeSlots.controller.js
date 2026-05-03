import pool from "../config/db.js";

function parseTimeToMinutes(timeString) {
  const [hours, minutes] = String(timeString).split(":").map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function diffMinutes(startTime, endTime) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);

  if (start === null || end === null) return null;
  return end - start;
}

function isValidDate(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function isWeekend(dateString) {
  const date = new Date(dateString);
  const day = date.getUTCDay();

  return day === 0 || day === 6;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function getAllTimeSlots(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        ts.id,
        ts.exam_period_id,
        ep.name AS exam_period_name,
        ts.slot_date,
        ts.start_time,
        ts.end_time,
        ts.duration_minutes,
        ts.is_active
      FROM time_slots ts
      JOIN exam_periods ep ON ep.id = ts.exam_period_id
      ORDER BY ts.slot_date ASC, ts.start_time ASC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get all time slots error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch time slots",
      error: error.message,
    });
  }
}

async function getTimeSlotById(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        ts.id,
        ts.exam_period_id,
        ep.name AS exam_period_name,
        ts.slot_date,
        ts.start_time,
        ts.end_time,
        ts.duration_minutes,
        ts.is_active
      FROM time_slots ts
      JOIN exam_periods ep ON ep.id = ts.exam_period_id
      WHERE ts.id = $1
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Time slot not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get time slot by id error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch time slot",
      error: error.message,
    });
  }
}

async function getTimeSlotsByExamPeriod(req, res) {
  try {
    const { examPeriodId } = req.params;

    const result = await pool.query(
      `
      SELECT
        ts.id,
        ts.exam_period_id,
        ts.slot_date,
        ts.start_time,
        ts.end_time,
        ts.duration_minutes,
        ts.is_active
      FROM time_slots ts
      WHERE ts.exam_period_id = $1
      ORDER BY ts.slot_date ASC, ts.start_time ASC
      `,
      [examPeriodId],
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get time slots by exam period error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch exam period time slots",
      error: error.message,
    });
  }
}

async function validateExamPeriodAndDate(client, examPeriodId, slotDate) {
  const examPeriodResult = await client.query(
    `
    SELECT id, start_date, end_date
    FROM exam_periods
    WHERE id = $1
    `,
    [examPeriodId],
  );

  if (examPeriodResult.rows.length === 0) {
    return {
      ok: false,
      status: 404,
      message: "Exam period not found",
    };
  }

  const examPeriod = examPeriodResult.rows[0];
  const startDate = examPeriod.start_date.toISOString().slice(0, 10);
  const endDate = examPeriod.end_date.toISOString().slice(0, 10);

  if (slotDate < startDate || slotDate > endDate) {
    return {
      ok: false,
      status: 400,
      message: "slot_date must be within the selected exam period date range",
    };
  }

  return {
    ok: true,
    examPeriod,
  };
}

async function createTimeSlot(req, res) {
  const client = await pool.connect();

  try {
    const {
      exam_period_id: examPeriodId,
      slot_date: slotDate,
      start_time: startTime,
      end_time: endTime,
      is_active: isActive = true,
    } = req.body ?? {};

    if (!examPeriodId) {
      return res.status(400).json({
        success: false,
        message: "exam_period_id is required",
      });
    }

    if (!slotDate || !isValidDate(slotDate)) {
      return res.status(400).json({
        success: false,
        message: "slot_date must be a valid date",
      });
    }

    if (!startTime) {
      return res.status(400).json({
        success: false,
        message: "start_time is required",
      });
    }

    if (!endTime) {
      return res.status(400).json({
        success: false,
        message: "end_time is required",
      });
    }

    const durationMinutes = diffMinutes(startTime, endTime);

    if (durationMinutes === null || durationMinutes <= 0) {
      return res.status(400).json({
        success: false,
        message: "end_time must be after start_time",
      });
    }

    const examPeriodCheck = await validateExamPeriodAndDate(
      client,
      examPeriodId,
      slotDate,
    );

    if (!examPeriodCheck.ok) {
      return res.status(examPeriodCheck.status).json({
        success: false,
        message: examPeriodCheck.message,
      });
    }

    const result = await client.query(
      `
      INSERT INTO time_slots (
        exam_period_id,
        slot_date,
        start_time,
        end_time,
        duration_minutes,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        exam_period_id,
        slot_date,
        start_time,
        end_time,
        duration_minutes,
        is_active
      `,
      [
        examPeriodId,
        slotDate,
        startTime,
        endTime,
        durationMinutes,
        Boolean(isActive),
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Time slot created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create time slot error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This time slot already exists for the exam period",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create time slot",
      error: error.message,
    });
  } finally {
    client.release();
  }
}

async function updateTimeSlot(req, res) {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      exam_period_id: examPeriodId,
      slot_date: slotDate,
      start_time: startTime,
      end_time: endTime,
      is_active: isActive = true,
    } = req.body ?? {};

    if (!examPeriodId) {
      return res.status(400).json({
        success: false,
        message: "exam_period_id is required",
      });
    }

    if (!slotDate || !isValidDate(slotDate)) {
      return res.status(400).json({
        success: false,
        message: "slot_date must be a valid date",
      });
    }

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "start_time and end_time are required",
      });
    }

    const durationMinutes = diffMinutes(startTime, endTime);

    if (durationMinutes === null || durationMinutes <= 0) {
      return res.status(400).json({
        success: false,
        message: "end_time must be after start_time",
      });
    }

    const examPeriodCheck = await validateExamPeriodAndDate(
      client,
      examPeriodId,
      slotDate,
    );

    if (!examPeriodCheck.ok) {
      return res.status(examPeriodCheck.status).json({
        success: false,
        message: examPeriodCheck.message,
      });
    }

    const result = await client.query(
      `
      UPDATE time_slots
      SET
        exam_period_id = $1,
        slot_date = $2,
        start_time = $3,
        end_time = $4,
        duration_minutes = $5,
        is_active = $6
      WHERE id = $7
      RETURNING
        id,
        exam_period_id,
        slot_date,
        start_time,
        end_time,
        duration_minutes,
        is_active
      `,
      [
        examPeriodId,
        slotDate,
        startTime,
        endTime,
        durationMinutes,
        Boolean(isActive),
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Time slot not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Time slot updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update time slot error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This time slot already exists for the exam period",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update time slot",
      error: error.message,
    });
  } finally {
    client.release();
  }
}

async function toggleTimeSlotActive(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE time_slots
      SET is_active = NOT is_active
      WHERE id = $1
      RETURNING
        id,
        exam_period_id,
        slot_date,
        start_time,
        end_time,
        duration_minutes,
        is_active
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Time slot not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Time slot active status updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Toggle time slot active error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to toggle time slot status",
      error: error.message,
    });
  }
}

async function deleteTimeSlot(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM time_slots
      WHERE id = $1
      RETURNING id, exam_period_id, slot_date, start_time, end_time
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Time slot not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Time slot deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Delete time slot error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete time slot",
      error: error.message,
    });
  }
}

async function clearTimeSlotsByExamPeriod(req, res) {
  try {
    const { examPeriodId } = req.params;

    const result = await pool.query(
      `
      DELETE FROM time_slots
      WHERE exam_period_id = $1
      RETURNING id
      `,
      [examPeriodId],
    );

    return res.status(200).json({
      success: true,
      message: "Exam period time slots cleared successfully",
      data: {
        deletedCount: result.rowCount,
      },
    });
  } catch (error) {
    console.error("Clear time slots by exam period error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to clear exam period time slots",
      error: error.message,
    });
  }
}

async function generateTimeSlots(req, res) {
  const client = await pool.connect();

  try {
    const {
      exam_period_id: examPeriodId,
      session_templates: sessionTemplates,
      include_weekends: includeWeekends = false,
      clear_existing: clearExisting = false,
    } = req.body ?? {};

    if (!examPeriodId) {
      return res.status(400).json({
        success: false,
        message: "exam_period_id is required",
      });
    }

    if (!Array.isArray(sessionTemplates) || sessionTemplates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "session_templates must be a non-empty array",
      });
    }

    for (const [index, session] of sessionTemplates.entries()) {
      const durationMinutes = diffMinutes(session.start_time, session.end_time);

      if (
        !session.start_time ||
        !session.end_time ||
        durationMinutes === null ||
        durationMinutes <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid session template at index ${index}`,
        });
      }
    }

    await client.query("BEGIN");

    const examPeriodResult = await client.query(
      `
      SELECT id, start_date, end_date
      FROM exam_periods
      WHERE id = $1
      `,
      [examPeriodId],
    );

    if (examPeriodResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Exam period not found",
      });
    }

    const examPeriod = examPeriodResult.rows[0];
    const startDate = examPeriod.start_date.toISOString().slice(0, 10);
    const endDate = examPeriod.end_date.toISOString().slice(0, 10);

    if (clearExisting) {
      await client.query(
        `
        DELETE FROM time_slots
        WHERE exam_period_id = $1
        `,
        [examPeriodId],
      );
    }

    const createdSlots = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
      if (!includeWeekends && isWeekend(currentDate)) {
        currentDate = addDays(currentDate, 1);
        continue;
      }

      for (const session of sessionTemplates) {
        const durationMinutes = diffMinutes(
          session.start_time,
          session.end_time,
        );

        const result = await client.query(
          `
          INSERT INTO time_slots (
            exam_period_id,
            slot_date,
            start_time,
            end_time,
            duration_minutes,
            is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (exam_period_id, slot_date, start_time, end_time)
          DO NOTHING
          RETURNING
            id,
            exam_period_id,
            slot_date,
            start_time,
            end_time,
            duration_minutes,
            is_active
          `,
          [
            examPeriodId,
            currentDate,
            session.start_time,
            session.end_time,
            durationMinutes,
            session.is_active ?? true,
          ],
        );

        if (result.rowCount > 0) {
          createdSlots.push(result.rows[0]);
        }
      }

      currentDate = addDays(currentDate, 1);
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Time slots generated successfully",
      data: {
        createdCount: createdSlots.length,
        exam_period_id: Number(examPeriodId),
        include_weekends: Boolean(includeWeekends),
        preview: createdSlots.slice(0, 20),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Generate time slots error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate time slots",
      error: error.message,
    });
  } finally {
    client.release();
  }
}

export {
  getAllTimeSlots,
  getTimeSlotById,
  getTimeSlotsByExamPeriod,
  createTimeSlot,
  updateTimeSlot,
  toggleTimeSlotActive,
  deleteTimeSlot,
  clearTimeSlotsByExamPeriod,
  generateTimeSlots,
};
