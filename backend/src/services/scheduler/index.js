import loadSchedulingData from "./loadSchedulingData.js";
import buildConflictGraph from "./buildConflictGraph.js";
import assignTimeSlots from "./assignTimeSlots.js";
import assignRooms from "./assignRooms.js";
import assignInstructors from "./assignInstructors.js";
import validateSchedule from "./validateSchedule.js";
import scoreSchedule from "./scoreSchedule.js";
import saveSchedule from "./saveSchedule.js";
import db from "../../config/db.js";

async function generateSchedulePhaseOne(examPeriodId) {
  const data = await loadSchedulingData(examPeriodId);
  const graphData = buildConflictGraph(data);

  return {
    examPeriod: data.examPeriod,
    summary: {
      courses: data.courses.length,
      rooms: data.rooms.length,
      timeSlots: data.timeSlots.length,
      enrollments: data.enrollments.length,
      exams: data.exams.length,
      conflictPairs: graphData.summary.totalConflictPairs,
      coursesWithConflicts: graphData.summary.coursesWithConflicts,
      coursesWithoutConflicts: graphData.summary.coursesWithoutConflicts,
      maxConflictWeight: graphData.summary.maxConflictWeight,
    },
    topPriorityCourses: graphData.courseOrder.slice(0, 10).map((course) => ({
      id: course.id,
      course_code: course.course_code,
      course_name: course.course_name,
      student_count: Number(
        course.student_count || course.student_count_cache || 0,
      ),
      conflict_count: course.metrics.conflict_count,
      total_conflict_weight: course.metrics.total_conflict_weight,
    })),
    conflictPairsPreview: graphData.conflictPairs.slice(0, 20),
  };
}

async function runFullScheduleGeneration(examPeriodId) {
  const data = await loadSchedulingData(examPeriodId);
  const graphData = buildConflictGraph(data);
  const slotAssignmentResult = assignTimeSlots(data, graphData);
  const roomAssignmentResult = assignRooms(data, slotAssignmentResult);
  const instructorAssignmentResult = assignInstructors(
    data,
    slotAssignmentResult,
    roomAssignmentResult,
  );

  const validationResult = validateSchedule(data, instructorAssignmentResult);
  const scoringResult = scoreSchedule(
    data,
    instructorAssignmentResult,
    validationResult,
  );

  await saveSchedule(
    examPeriodId,
    slotAssignmentResult,
    roomAssignmentResult,
    instructorAssignmentResult,
    scoringResult,
  );

  return {
    examPeriod: data.examPeriod,
    graphSummary: graphData.summary,
    slotAssignment: {
      summary: slotAssignmentResult.summary,
    },
    roomAssignment: {
      summary: roomAssignmentResult.summary,
    },
    instructorAssignment: {
      summary: instructorAssignmentResult.summary,
    },
    validation: validationResult,
    scoring: scoringResult,
  };
}

async function getScheduleReport(examPeriodId) {
  const examPeriodResult = await db.query(
    `
    SELECT
      id,
  name,
  academic_year,
  term,
  exam_type,
  start_date,
  end_date,
  status,
  schedule_quality_score,
  schedule_metrics,
  last_scheduled_at
    FROM exam_periods
    WHERE id = $1
    LIMIT 1
    `,
    [examPeriodId],
  );

  if (examPeriodResult.rows.length === 0) {
    throw new Error(`Exam period not found: ${examPeriodId}`);
  }

  const examPeriod = examPeriodResult.rows[0];

  const examsResult = await db.query(
    `
    SELECT
      e.id AS exam_id,
      e.course_id,
      c.course_code,
      c.course_name,
      c.exam_duration_minutes,
      c.student_count_cache,
      ts.id AS time_slot_id,
      ts.slot_date,
      ts.start_time,
      ts.end_time,
      e.status,
      pi.id AS primary_instructor_id,
      pi.full_name AS primary_instructor_name
    FROM exams e
    INNER JOIN courses c ON c.id = e.course_id
    LEFT JOIN time_slots ts ON ts.id = e.time_slot_id
    LEFT JOIN instructors pi ON pi.id = e.primary_instructor_id
    WHERE e.exam_period_id = $1
    ORDER BY ts.slot_date NULLS LAST, ts.start_time NULLS LAST, c.course_code
    `,
    [examPeriodId],
  );

  const roomAssignmentsResult = await db.query(
    `
    SELECT
      era.exam_id,
      r.id AS room_id,
      r.room_code,
      r.building,
      r.capacity,
      era.assigned_capacity,
      si.id AS supervisor_instructor_id,
      si.full_name AS supervisor_instructor_name
    FROM exam_room_assignments era
    INNER JOIN rooms r ON r.id = era.room_id
    LEFT JOIN instructors si ON si.id = era.supervisor_instructor_id
    WHERE era.exam_id IN (
      SELECT id
      FROM exams
      WHERE exam_period_id = $1
    )
    ORDER BY era.exam_id, r.room_code
    `,
    [examPeriodId],
  );

  async function runFullScheduleGenerationPreview(examPeriodId) {
    const data = await loadSchedulingData(examPeriodId);
    const graphData = buildConflictGraph(data);
    const slotAssignmentResult = assignTimeSlots(data, graphData);
    const roomAssignmentResult = assignRooms(data, slotAssignmentResult);
    const instructorAssignmentResult = assignInstructors(
      data,
      slotAssignmentResult,
      roomAssignmentResult,
    );

    const validationResult = validateSchedule(data, instructorAssignmentResult);
    const scoringResult = scoreSchedule(
      data,
      instructorAssignmentResult,
      validationResult,
    );

    return {
      validation: validationResult,
      scoring: scoringResult,
    };
  }

  const roomsByExamId = {};
  for (const row of roomAssignmentsResult.rows) {
    if (!roomsByExamId[row.exam_id]) {
      roomsByExamId[row.exam_id] = [];
    }

    roomsByExamId[row.exam_id].push({
      room_id: row.room_id,
      room_code: row.room_code,
      building: row.building,
      capacity: Number(row.capacity),
      assigned_capacity: Number(row.assigned_capacity),
      supervisor_instructor_id: row.supervisor_instructor_id,
      supervisor_instructor_name: row.supervisor_instructor_name,
    });
  }

  const scheduleByDay = {};
  const unscheduledExams = [];

  for (const exam of examsResult.rows) {
    const examItem = {
      exam_id: exam.exam_id,
      course_id: exam.course_id,
      course_code: exam.course_code,
      course_name: exam.course_name,
      exam_duration_minutes: Number(exam.exam_duration_minutes),
      student_count: Number(exam.student_count_cache || 0),
      time_slot_id: exam.time_slot_id,
      start_time: exam.start_time,
      end_time: exam.end_time,
      status: exam.status,
      primary_instructor: exam.primary_instructor_id
        ? {
            id: exam.primary_instructor_id,
            full_name: exam.primary_instructor_name,
          }
        : null,
      rooms: roomsByExamId[exam.exam_id] || [],
    };

    if (!exam.slot_date) {
      unscheduledExams.push(examItem);
      continue;
    }

    if (!scheduleByDay[exam.slot_date]) {
      scheduleByDay[exam.slot_date] = [];
    }

    scheduleByDay[exam.slot_date].push(examItem);
  }

  for (const day of Object.keys(scheduleByDay)) {
    scheduleByDay[day].sort((a, b) => {
      if (a.start_time !== b.start_time) {
        return String(a.start_time).localeCompare(String(b.start_time));
      }

      return String(a.course_code).localeCompare(String(b.course_code));
    });
  }

  const daySummaries = Object.entries(scheduleByDay).map(([date, exams]) => ({
    date,
    totalExams: exams.length,
    totalStudents: exams.reduce(
      (sum, exam) => sum + Number(exam.student_count || 0),
      0,
    ),
    exams,
  }));

  return {
    examPeriod,
    summary: {
      totalExams: examsResult.rows.length,
      scheduledExams: examsResult.rows.filter((row) => row.time_slot_id).length,
      unscheduledExams: unscheduledExams.length,
      totalDaysUsed: daySummaries.length,
    },
    scoring: {
      qualityScore: examPeriod.schedule_quality_score
        ? Number(examPeriod.schedule_quality_score)
        : null,
      metrics: examPeriod.schedule_metrics || {},
      lastScheduledAt: examPeriod.last_scheduled_at,
    },
    dayByDaySchedule: daySummaries,
    unscheduledExams,
  };
}

export {
  generateSchedulePhaseOne,
  runFullScheduleGeneration,
  getScheduleReport,
};

export default {
  generateSchedulePhaseOne,
  runFullScheduleGeneration,
  getScheduleReport,
};
