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

function calculateSlotPenalty({
  courseId,
  slot,
  conflictGraph,
  currentAssignments,
  timeSlotsById,
  instructorsByCourse,
}) {
  let penalty = 0;
  const slotDate = slot.slot_date;
  const slotStart = slot.start_time;
  const candidateInstructorId = getPrimaryInstructorId(
    instructorsByCourse,
    courseId,
  );
  const neighbors = conflictGraph[courseId] || {};

  for (const neighborCourseId of Object.keys(neighbors)) {
    const assigned = currentAssignments[neighborCourseId];
    if (!assigned?.time_slot_id) continue;

    const assignedSlot = timeSlotsById[assigned.time_slot_id];
    if (!assignedSlot) continue;

    const weight = Number(neighbors[neighborCourseId]) || 0;

    if (assignedSlot.slot_date === slotDate) {
      penalty += weight * 3;
    }

    const candidateStartsLater =
      slot.slot_date === assignedSlot.slot_date &&
      slot.start_time > assignedSlot.start_time;
    const assignedStartsLater =
      slot.slot_date === assignedSlot.slot_date &&
      assignedSlot.start_time > slot.start_time;

    if (
      (candidateStartsLater || assignedStartsLater) &&
      Math.abs(
        timeToMinutes(slotStart) - timeToMinutes(assignedSlot.start_time),
      ) <= 180
    ) {
      penalty += weight * 2;
    }
  }

  if (candidateInstructorId) {
    let sameDayInstructorLoad = 0;

    for (const assignedCourseId of Object.keys(currentAssignments)) {
      const assigned = currentAssignments[assignedCourseId];
      if (!assigned?.time_slot_id) continue;

      const assignedSlot = timeSlotsById[assigned.time_slot_id];
      if (!assignedSlot) continue;

      const assignedInstructorId = getPrimaryInstructorId(
        instructorsByCourse,
        Number(assignedCourseId),
      );

      if (
        Number(assignedInstructorId) === Number(candidateInstructorId) &&
        assignedSlot.slot_date === slotDate
      ) {
        sameDayInstructorLoad += 1;
      }
    }

    penalty += sameDayInstructorLoad * 4;
  }

  let sameDayExamCount = 0;

  for (const assignedCourseId of Object.keys(currentAssignments)) {
    const assigned = currentAssignments[assignedCourseId];
    if (!assigned?.time_slot_id) continue;

    const assignedSlot = timeSlotsById[assigned.time_slot_id];
    if (!assignedSlot) continue;

    if (assignedSlot.slot_date === slotDate) {
      sameDayExamCount += 1;
    }
  }

  penalty += sameDayExamCount * 0.5;

  return penalty;
}

function timeToMinutes(timeValue) {
  const [hours, minutes, seconds = "0"] = String(timeValue).split(":");
  return (
    Number(hours) * 60 + Number(minutes) + Math.floor(Number(seconds) / 60)
  );
}

function assignTimeSlots(data, graphData) {
  const { coursesById, timeSlots, examsByCourseId, instructorsByCourse } = data;
  const { conflictGraph, courseOrder } = graphData;

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

  const scheduled = [];
  const unscheduled = [];

  for (const course of courseOrder) {
    const courseId = course.id;
    let bestSlot = null;
    let bestPenalty = Number.POSITIVE_INFINITY;

    for (const slot of sortedSlots) {
      const validity = hasConflictInSlot({
        courseId,
        slot,
        conflictGraph,
        currentAssignments,
        coursesById,
        instructorsByCourse,
      });

      if (!validity.valid) {
        continue;
      }

      const penalty = calculateSlotPenalty({
        courseId,
        slot,
        conflictGraph,
        currentAssignments,
        timeSlotsById,
        instructorsByCourse,
      });

      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestSlot = slot;
      }
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

    scheduled.push({
      course_id: courseId,
      course_code: course.course_code,
      course_name: course.course_name,
      time_slot_id: bestSlot.id,
      slot_date: bestSlot.slot_date,
      start_time: bestSlot.start_time,
      end_time: bestSlot.end_time,
      penalty: bestPenalty,
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
