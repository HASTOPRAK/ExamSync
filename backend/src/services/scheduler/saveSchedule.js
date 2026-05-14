import db from "../../config/db.js";
import { invalidateScheduleCache } from "../../utils/scheduleCache.js";

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

    if (scheduledCourseIds.length > 0) {
      await client.query(
        `INSERT INTO exams (exam_period_id, course_id, time_slot_id, primary_instructor_id, status)
         SELECT $1, course_id, NULL, NULL, 'draft'
         FROM UNNEST($2::int[]) AS t(course_id)
         ON CONFLICT (exam_period_id, course_id) DO NOTHING`,
        [examPeriodId, scheduledCourseIds],
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

    const examIds = [];
    const timeSlotIds = [];
    const instructorIds = [];
    const statuses = [];

    for (const assignment of finalAssignments) {
      const examId = examIdByCourseId[Number(assignment.course_id)];
      if (!examId) {
        throw new Error(
          `Missing exam row for course_id=${assignment.course_id} in exam_period_id=${examPeriodId}`,
        );
      }
      examIds.push(examId);
      timeSlotIds.push(assignment.time_slot_id ?? null);
      instructorIds.push(assignment.primary_instructor_id ?? null);
      statuses.push(assignment.status);
    }

    if (examIds.length > 0) {
      await client.query(
        `UPDATE exams
         SET time_slot_id = v.time_slot_id,
             primary_instructor_id = v.primary_instructor_id,
             status = v.status
         FROM (
           SELECT * FROM UNNEST($1::int[], $2::int[], $3::int[], $4::text[])
             AS t(exam_id, time_slot_id, primary_instructor_id, status)
         ) v
         WHERE exams.id = v.exam_id`,
        [examIds, timeSlotIds, instructorIds, statuses],
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

    if (finalRoomAssignments.length > 0) {
      const raExamIds = [];
      const raRoomIds = [];
      const raCapacities = [];
      const raSupervisors = [];

      for (const ra of finalRoomAssignments) {
        const examId = ra.exam_id || examIdByCourseId[Number(ra.course_id)];
        if (!examId) {
          throw new Error(
            `Cannot create room assignment without exam_id for course_id=${ra.course_id}`,
          );
        }
        raExamIds.push(examId);
        raRoomIds.push(ra.room_id);
        raCapacities.push(ra.assigned_capacity);
        raSupervisors.push(ra.supervisor_instructor_id ?? null);
      }

      await client.query(
        `INSERT INTO exam_room_assignments (exam_id, room_id, assigned_capacity, supervisor_instructor_id)
         SELECT exam_id, room_id, assigned_capacity, supervisor_instructor_id
         FROM UNNEST($1::int[], $2::int[], $3::int[], $4::int[])
           AS t(exam_id, room_id, assigned_capacity, supervisor_instructor_id)`,
        [raExamIds, raRoomIds, raCapacities, raSupervisors],
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
    invalidateScheduleCache();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export default saveSchedule;
