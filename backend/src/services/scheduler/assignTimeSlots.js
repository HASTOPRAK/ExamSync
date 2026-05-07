function groupExamsBySlot(assignments) {
  const examsBySlot = {};

  for (const assignment of assignments) {
    if (!assignment.time_slot_id) continue;

    if (!examsBySlot[assignment.time_slot_id]) {
      examsBySlot[assignment.time_slot_id] = [];
    }

    examsBySlot[assignment.time_slot_id].push(assignment);
  }

  return examsBySlot;
}

function buildCourseAssignmentMap(assignments) {
  const map = {};

  for (const assignment of assignments) {
    map[assignment.course_id] = assignment;
  }

  return map;
}

function getPrimaryInstructorId(instructorsByCourse, courseId) {
  const instructors = instructorsByCourse[courseId] || [];
  const primary = instructors.find((item) => item.role === "primary");

  return primary ? primary.instructor_id : null;
}

function timeToMinutes(timeValue) {
  const [hours, minutes, seconds = "0"] = String(timeValue).split(":");
  return (
    Number(hours) * 60 + Number(minutes) + Math.floor(Number(seconds) / 60)
  );
}

/**
 * Hard-constraint check: can this course be placed in this specific slot?
 * Blocks only if a conflicting course (shared students) or same instructor
 * is already in the SAME slot ID.
 */
function hasConflictInSlot({
  courseId,
  slot,
  conflictGraph,
  currentAssignments,
  coursesById,
  instructorsByCourse,
}) {
  const currentCourse = coursesById[courseId];
  const slotId = slot.id;

  if (!currentCourse) {
    return { valid: false, reason: "Course not found" };
  }

  if (
    Number(currentCourse.exam_duration_minutes) > Number(slot.duration_minutes)
  ) {
    return { valid: false, reason: "Exam duration exceeds slot duration" };
  }

  const neighbors = conflictGraph[courseId] || {};

  for (const neighborCourseId of Object.keys(neighbors)) {
    const assigned = currentAssignments[neighborCourseId];

    if (assigned && Number(assigned.time_slot_id) === Number(slotId)) {
      return { valid: false, reason: "Student conflict in same slot" };
    }
  }

  const candidateInstructorId = getPrimaryInstructorId(
    instructorsByCourse,
    courseId,
  );

  if (candidateInstructorId) {
    for (const assignedCourseId of Object.keys(currentAssignments)) {
      const assigned = currentAssignments[assignedCourseId];

      if (Number(assigned.time_slot_id) !== Number(slotId)) continue;

      const assignedInstructorId = getPrimaryInstructorId(
        instructorsByCourse,
        Number(assignedCourseId),
      );

      if (
        assignedInstructorId &&
        Number(assignedInstructorId) === Number(candidateInstructorId)
      ) {
        return { valid: false, reason: "Instructor conflict in same slot" };
      }
    }
  }

  return { valid: true };
}

/**
 * Returns the set of dates on which any conflicting neighbour of courseId
 * already has an exam assigned.
 */
function getConflictDays(courseId, conflictGraph, currentAssignments, timeSlotsById) {
  const days = new Set();
  const neighbors = conflictGraph[courseId] || {};

  for (const neighborId of Object.keys(neighbors)) {
    const assigned = currentAssignments[neighborId];
    if (!assigned?.time_slot_id) continue;

    const slot = timeSlotsById[assigned.time_slot_id];
    if (slot) days.add(slot.slot_date);
  }

  return days;
}

/**
 * Among the conflicting neighbours already scheduled on `day`, returns the
 * minimum absolute gap (in minutes) between `slot` and the nearest
 * neighbour slot on that day. Returns Infinity when no neighbours are on
 * that day.
 */
function minGapToNeighboursOnDay(
  courseId,
  day,
  slot,
  conflictGraph,
  currentAssignments,
  timeSlotsById,
) {
  const neighbors = conflictGraph[courseId] || {};
  let minGap = Infinity;

  for (const neighborId of Object.keys(neighbors)) {
    const assigned = currentAssignments[neighborId];
    if (!assigned?.time_slot_id) continue;

    const neighborSlot = timeSlotsById[assigned.time_slot_id];
    if (!neighborSlot || neighborSlot.slot_date !== day) continue;

    const gap = Math.abs(
      timeToMinutes(slot.start_time) - timeToMinutes(neighborSlot.start_time),
    );
    if (gap < minGap) minGap = gap;
  }

  return minGap;
}

/**
 * Day-first distributed assignment algorithm.
 *
 * Strategy per course (in priority order):
 *   1. Sort days by (exam_count ASC, conflict-free first, date ASC).
 *   2. On each day, collect valid slots (no hard conflict in the same slot).
 *   3. Among valid slots on a conflict-free day: pick the earliest slot.
 *   4. On a day that already has a conflicting neighbour: pick the slot with
 *      the greatest gap from that neighbour (buffers back-to-back exams).
 *   5. Use the first valid conflict-free day found; fall back to the
 *      least-bad conflict day only if no conflict-free option exists.
 */
function assignTimeSlots(data, graphData) {
  const { coursesById, timeSlots, examsByCourseId, instructorsByCourse } = data;
  const { conflictGraph, courseOrder } = graphData;

  // ── build slot lookups ────────────────────────────────────────────────────
  const sortedSlots = [...timeSlots].sort((a, b) => {
    if (a.slot_date !== b.slot_date) {
      return new Date(a.slot_date) - new Date(b.slot_date);
    }
    return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
  });

  const timeSlotsById = {};
  for (const slot of sortedSlots) {
    timeSlotsById[slot.id] = slot;
  }

  // group slots by calendar date (already time-sorted within each day)
  const slotsByDay = {};
  for (const slot of sortedSlots) {
    if (!slotsByDay[slot.slot_date]) slotsByDay[slot.slot_date] = [];
    slotsByDay[slot.slot_date].push(slot);
  }
  const allDays = Object.keys(slotsByDay).sort(); // chronological

  // ── initialise assignments (carry over pre-existing exams) ────────────────
  const initialAssignments = [];

  for (const course of courseOrder) {
    const existingExam = examsByCourseId[course.id];

    initialAssignments.push({
      exam_id: existingExam?.id || null,
      course_id: course.id,
      time_slot_id: existingExam?.time_slot_id || null,
      primary_instructor_id:
        existingExam?.primary_instructor_id ||
        getPrimaryInstructorId(instructorsByCourse, course.id),
      status: existingExam?.status || "draft",
    });
  }

  const currentAssignments = buildCourseAssignmentMap(initialAssignments);

  // initialise day exam counts (seed from pre-existing assignments)
  const dayExamCount = Object.fromEntries(allDays.map((d) => [d, 0]));
  for (const assignment of initialAssignments) {
    if (!assignment.time_slot_id) continue;
    const slot = timeSlotsById[assignment.time_slot_id];
    if (slot && dayExamCount[slot.slot_date] !== undefined) {
      dayExamCount[slot.slot_date] += 1;
    }
  }

  // ── assign each course ────────────────────────────────────────────────────
  const scheduled = [];
  const unscheduled = [];

  for (const course of courseOrder) {
    const courseId = course.id;

    // Which days already have a conflicting neighbour scheduled?
    const conflictDays = getConflictDays(
      courseId,
      conflictGraph,
      currentAssignments,
      timeSlotsById,
    );

    // Sort days: conflict-free first, then by occupancy (asc), then by date (asc)
    const sortedDays = [...allDays].sort((a, b) => {
      const aClear = !conflictDays.has(a);
      const bClear = !conflictDays.has(b);

      if (aClear !== bClear) return aClear ? -1 : 1;
      if (dayExamCount[a] !== dayExamCount[b])
        return dayExamCount[a] - dayExamCount[b];
      return a.localeCompare(b);
    });

    let bestSlot = null;
    let bestIsOnClearDay = false;
    let bestGap = -Infinity;

    for (const day of sortedDays) {
      const dayIsClear = !conflictDays.has(day);

      // Once we've already found a slot on a clear day, stop scanning conflict days
      if (bestIsOnClearDay && !dayIsClear) break;

      const slots = slotsByDay[day];

      for (const slot of slots) {
        const validity = hasConflictInSlot({
          courseId,
          slot,
          conflictGraph,
          currentAssignments,
          coursesById,
          instructorsByCourse,
        });

        if (!validity.valid) continue;

        if (dayIsClear) {
          // Clear day: take the earliest valid slot immediately
          bestSlot = slot;
          bestIsOnClearDay = true;
          break; // earliest slot on this clear day is best
        } else {
          // Conflict day: prefer the slot with the largest gap to neighbours
          const gap = minGapToNeighboursOnDay(
            courseId,
            day,
            slot,
            conflictGraph,
            currentAssignments,
            timeSlotsById,
          );

          if (!bestSlot || gap > bestGap) {
            bestSlot = slot;
            bestGap = gap;
          }
        }
      }

      // Found a slot on a clear day — no need to look further
      if (bestIsOnClearDay) break;
    }

    if (!bestSlot) {
      currentAssignments[courseId] = {
        ...currentAssignments[courseId],
        time_slot_id: null,
        status: "unscheduled",
      };

      unscheduled.push({
        course_id: courseId,
        course_code: course.course_code,
        course_name: course.course_name,
        reason: "No valid time slot found",
      });

      continue;
    }

    currentAssignments[courseId] = {
      ...currentAssignments[courseId],
      time_slot_id: bestSlot.id,
      status: "scheduled",
    };

    dayExamCount[bestSlot.slot_date] += 1;

    scheduled.push({
      course_id: courseId,
      course_code: course.course_code,
      course_name: course.course_name,
      time_slot_id: bestSlot.id,
      slot_date: bestSlot.slot_date,
      start_time: bestSlot.start_time,
      end_time: bestSlot.end_time,
    });
  }

  const finalAssignments = Object.values(currentAssignments);
  const examsBySlot = groupExamsBySlot(finalAssignments);

  return {
    assignments: finalAssignments,
    scheduled,
    unscheduled,
    examsBySlot,
    summary: {
      totalCourses: courseOrder.length,
      scheduledCount: scheduled.length,
      unscheduledCount: unscheduled.length,
      usedSlotCount: Object.keys(examsBySlot).length,
    },
  };
}

export default assignTimeSlots;
