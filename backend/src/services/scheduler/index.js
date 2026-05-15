import loadSchedulingData from "./loadSchedulingData.js";
import buildConflictGraph from "./buildConflictGraph.js";
import assignTimeSlots from "./assignTimeSlots.js";
import assignRooms from "./assignRooms.js";
import assignInstructors from "./assignInstructors.js";
import validateSchedule from "./validateSchedule.js";
import scoreSchedule from "./scoreSchedule.js";
import saveSchedule from "./saveSchedule.js";
import db from "../../config/db.js";

async function generateSchedulePhaseOne(examPeriodId, ownerId) {
  const data = await loadSchedulingData(examPeriodId, ownerId);
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

async function runFullScheduleGeneration(examPeriodId, ownerId) {
  // ── 1. Load data ────────────────────────────────────────────────────────────
  const data = await loadSchedulingData(examPeriodId, ownerId);

  console.log("\n═══════════════════════════════════════════");
  console.log(`SCHEDULER  exam_period=${examPeriodId}  owner=${ownerId}`);
  console.log("═══════════════════════════════════════════");
  console.log("[1] DATA LOADED");
  console.log(`    courses:     ${data.courses.length}`);
  console.log(`    rooms:       ${data.rooms.length}  (active only)`);
  console.log(`    time slots:  ${data.timeSlots.length}  (active only)`);
  console.log(`    exams:       ${data.exams.length}`);
  console.log(`    enrollments: ${data.enrollments.length}`);

  const zeroCourses = data.courses.filter(
    (c) => (data.coursesById[c.id]?.student_count ?? 0) === 0,
  );
  if (zeroCourses.length) {
    console.log(`    ⚠ courses with 0 enrolled students: ${zeroCourses.length}`);
    zeroCourses.slice(0, 5).forEach((c) =>
      console.log(`      - ${c.course_code}  ${c.course_name}`),
    );
  }

  // ── 2. Conflict graph ───────────────────────────────────────────────────────
  const graphData = buildConflictGraph(data);

  console.log("[2] CONFLICT GRAPH");
  console.log(`    total courses:           ${graphData.summary.totalCourses}`);
  console.log(`    courses with conflicts:  ${graphData.summary.coursesWithConflicts}`);
  console.log(`    courses without:         ${graphData.summary.coursesWithoutConflicts}`);
  console.log(`    conflict pairs:          ${graphData.summary.totalConflictPairs}`);
  console.log(`    max shared students:     ${graphData.summary.maxConflictWeight}`);

  // ── 3. Slot assignment ──────────────────────────────────────────────────────
  const slotAssignmentResult = assignTimeSlots(data, graphData);

  console.log("[3] SLOT ASSIGNMENT");
  console.log(`    scheduled:   ${slotAssignmentResult.summary.scheduledCount}`);
  console.log(`    unscheduled: ${slotAssignmentResult.summary.unscheduledCount}`);
  console.log(`    slots used:  ${slotAssignmentResult.summary.usedSlotCount}`);
  if (slotAssignmentResult.unscheduled.length) {
    console.log("    unscheduled courses:");
    slotAssignmentResult.unscheduled.slice(0, 10).forEach((u) =>
      console.log(`      - ${u.course_code}  reason: ${u.reason}`),
    );
  }

  // Per-slot exam counts
  const slotCounts = Object.entries(slotAssignmentResult.examsBySlot)
    .map(([id, exams]) => ({ id, count: exams.length }))
    .sort((a, b) => b.count - a.count);
  if (slotCounts.length) {
    console.log(`    slot load (top 5): ${slotCounts.slice(0, 5).map((s) => `slot${s.id}:${s.count}`).join("  ")}`);
  }

  // ── 4. Room assignment ──────────────────────────────────────────────────────
  const roomAssignmentResult = assignRooms(data, slotAssignmentResult);

  console.log("[4] ROOM ASSIGNMENT");
  console.log(`    exams with rooms:    ${roomAssignmentResult.summary.examsWithRooms}`);
  console.log(`    exams without rooms: ${roomAssignmentResult.summary.examsWithoutRooms}`);
  console.log(`    room assignments:    ${roomAssignmentResult.summary.roomAssignmentsCreated}`);
  if (roomAssignmentResult.roomlessExams.length) {
    const reasons = {};
    for (const e of roomAssignmentResult.roomlessExams) {
      reasons[e.reason] = (reasons[e.reason] || 0) + 1;
    }
    console.log("    roomless reasons:", reasons);
    roomAssignmentResult.roomlessExams.slice(0, 5).forEach((e) =>
      console.log(`      - ${e.course_code}  reason: ${e.reason}`),
    );
  }

  // ── 5. Instructor assignment ────────────────────────────────────────────────
  const instructorAssignmentResult = assignInstructors(
    data,
    slotAssignmentResult,
    roomAssignmentResult,
  );

  console.log("[5] INSTRUCTOR ASSIGNMENT");
  console.log(`    summary: ${JSON.stringify(instructorAssignmentResult.summary)}`);

  // ── 6. Validation ───────────────────────────────────────────────────────────
  const validationResult = validateSchedule(data, instructorAssignmentResult);

  console.log("[6] VALIDATION");
  console.log(`    hard violations: ${validationResult.summary.hardConstraintViolations}`);
  console.log(`    warnings:        ${validationResult.summary.warnings}`);
  if (validationResult.issues.length) {
    const byType = {};
    for (const issue of validationResult.issues) {
      byType[issue.type] = (byType[issue.type] || 0) + 1;
    }
    console.log("    issues by type:", byType);
  }

  // ── 7. Scoring ──────────────────────────────────────────────────────────────
  const scoringResult = scoreSchedule(
    data,
    instructorAssignmentResult,
    validationResult,
  );

  console.log("[7] SCORING");
  console.log(`    quality score: ${scoringResult.qualityScore}`);
  console.log(`    metrics:`, {
    totalExams:                  scoringResult.metrics.totalExams,
    scheduledExams:              scoringResult.metrics.scheduledExams,
    averageRoomUtilization:      scoringResult.metrics.averageRoomUtilization,
    sameDayStudentConflicts:     scoringResult.metrics.sameDayStudentConflicts,
    closeSameDayConflicts:       scoringResult.metrics.closeSameDayStudentConflicts,
    maxExamsPerStudentPerDay:    scoringResult.metrics.maxExamsPerStudentPerDay,
    mostCrowdedDay:              scoringResult.metrics.mostCrowdedDay,
  });
  console.log("═══════════════════════════════════════════\n");

  // ── 8. Save ─────────────────────────────────────────────────────────────────
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
      unscheduled: slotAssignmentResult.unscheduled,
    },
    roomAssignment: {
      summary: roomAssignmentResult.summary,
      roomlessExams: roomAssignmentResult.roomlessExams,
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
    `SELECT
      id, name, academic_year, term, exam_type,
      start_date, end_date, status,
      schedule_quality_score, schedule_metrics, last_scheduled_at
     FROM exam_periods
     WHERE id = $1
     LIMIT 1`,
    [examPeriodId],
  );

  if (examPeriodResult.rows.length === 0) {
    throw new Error(`Exam period not found: ${examPeriodId}`);
  }

  const examPeriod = examPeriodResult.rows[0];

  const examsResult = await db.query(
    `SELECT
      e.id AS exam_id,
      e.course_id,
      c.course_code,
      c.course_name,
      c.exam_duration_minutes,
      c.student_count_cache,
      ts.id AS time_slot_id,
      ts.slot_date::text AS slot_date,
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
     ORDER BY ts.slot_date NULLS LAST, ts.start_time NULLS LAST, c.course_code`,
    [examPeriodId],
  );

  const roomAssignmentsResult = await db.query(
    `SELECT
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
     WHERE era.exam_id IN (SELECT id FROM exams WHERE exam_period_id = $1)
     ORDER BY era.exam_id, r.room_code`,
    [examPeriodId],
  );

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
        ? { id: exam.primary_instructor_id, full_name: exam.primary_instructor_name }
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
    totalStudents: exams.reduce((sum, exam) => sum + Number(exam.student_count || 0), 0),
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
