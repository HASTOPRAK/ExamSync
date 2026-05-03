import db from "../../config/db.js";

async function saveSchedule(
  examPeriodId,
  slotAssignmentResult,
  roomAssignmentResult = null,
  instructorAssignmentResult = null,
  scoringResult = null,
) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const finalAssignments =
      instructorAssignmentResult?.assignments ||
      roomAssignmentResult?.assignments ||
      slotAssignmentResult.assignments;

    const scheduledCourseIds = [
      ...new Set(
        finalAssignments
          .filter((assignment) => assignment.course_id)
          .map((assignment) => Number(assignment.course_id)),
      ),
    ];

    for (const courseId of scheduledCourseIds) {
      await client.query(
        `
        INSERT INTO exams (
          exam_period_id,
          course_id,
          time_slot_id,
          primary_instructor_id,
          status
        )
        VALUES ($1, $2, NULL, NULL, 'draft')
        ON CONFLICT (exam_period_id, course_id) DO NOTHING
        `,
        [examPeriodId, courseId],
      );
    }

    const examsResult = await client.query(
      `
      SELECT id, course_id
      FROM exams
      WHERE exam_period_id = $1
      `,
      [examPeriodId],
    );

    const examIdByCourseId = {};
    for (const row of examsResult.rows) {
      examIdByCourseId[Number(row.course_id)] = Number(row.id);
    }

    for (const assignment of finalAssignments) {
      const examId = examIdByCourseId[Number(assignment.course_id)];

      if (!examId) {
        throw new Error(
          `Missing exam row for course_id=${assignment.course_id} in exam_period_id=${examPeriodId}`,
        );
      }
      await client.query(
        `
        UPDATE exams
        SET
          time_slot_id = $1,
          primary_instructor_id = $2,
          status = $3
        WHERE id = $4
        `,
        [
          assignment.time_slot_id,
          assignment.primary_instructor_id,
          assignment.status,
          examId,
        ],
      );
    }

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

    const finalRoomAssignments =
      instructorAssignmentResult?.roomAssignments ||
      roomAssignmentResult?.roomAssignments ||
      [];

    for (const roomAssignment of finalRoomAssignments) {
      const examId =
        roomAssignment.exam_id ||
        examIdByCourseId[Number(roomAssignment.course_id)];

      if (!examId) {
        throw new Error(
          `Cannot create room assignment without exam_id for course_id=${roomAssignment.course_id}`,
        );
      }
      await client.query(
        `
        INSERT INTO exam_room_assignments (
          exam_id,
          room_id,
          assigned_capacity,
          supervisor_instructor_id
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          examId,
          roomAssignment.room_id,
          roomAssignment.assigned_capacity,
          roomAssignment.supervisor_instructor_id,
        ],
      );
    }
    if (scoringResult) {
      await client.query(
        `
    UPDATE exam_periods
    SET
      schedule_quality_score = $1,
      schedule_metrics = $2::jsonb,
      last_scheduled_at = CURRENT_TIMESTAMP
    WHERE id = $3
    `,
        [
          scoringResult.qualityScore,
          JSON.stringify(scoringResult.metrics || {}),
          examPeriodId,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export default saveSchedule;
