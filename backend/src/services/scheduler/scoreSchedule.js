function buildTimeSlotsById(timeSlots) {
  return Object.fromEntries(timeSlots.map((slot) => [slot.id, slot]));
}

function calculateAverageRoomUtilization(data, roomAssignments) {
  if (!roomAssignments.length) return 0;

  const totalUtilization = roomAssignments.reduce((sum, item) => {
    const capacity = Number(item.room_capacity || 0);
    const assigned = Number(item.assigned_capacity || 0);

    if (capacity <= 0) return sum;
    return sum + assigned / capacity;
  }, 0);

  return Number((totalUtilization / roomAssignments.length).toFixed(4));
}

function calculateMostCrowdedDay(assignments, timeSlotsById) {
  const dayCounts = {};

  for (const assignment of assignments) {
    if (!assignment.time_slot_id) continue;

    const slot = timeSlotsById[assignment.time_slot_id];
    if (!slot) continue;

    const day = slot.slot_date;
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }

  let bestDay = null;
  let bestCount = 0;

  for (const [day, count] of Object.entries(dayCounts)) {
    if (count > bestCount) {
      bestDay = day;
      bestCount = count;
    }
  }

  return {
    date: bestDay,
    examCount: bestCount,
  };
}

function timeToMinutes(timeValue) {
  const [hours, minutes, seconds = "0"] = String(timeValue).split(":");
  return (
    Number(hours) * 60 + Number(minutes) + Math.floor(Number(seconds) / 60)
  );
}

function calculateCloseSameDayStudentConflicts(
  data,
  assignments,
  timeSlotsById,
) {
  const courseToSlot = {};

  for (const assignment of assignments) {
    if (assignment.time_slot_id) {
      courseToSlot[assignment.course_id] = assignment.time_slot_id;
    }
  }

  let total = 0;

  for (const courseIds of Object.values(data.coursesByStudent || {})) {
    const studentSlots = [];

    for (const courseId of courseIds) {
      const slotId = courseToSlot[courseId];
      if (!slotId) continue;

      const slot = timeSlotsById[slotId];
      if (!slot) continue;

      studentSlots.push(slot);
    }

    studentSlots.sort((a, b) => {
      if (a.slot_date !== b.slot_date) {
        return new Date(a.slot_date) - new Date(b.slot_date);
      }

      return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
    });

    for (let i = 1; i < studentSlots.length; i += 1) {
      const prev = studentSlots[i - 1];
      const curr = studentSlots[i];

      if (prev.slot_date !== curr.slot_date) continue;

      const diff = Math.abs(
        timeToMinutes(curr.start_time) - timeToMinutes(prev.start_time),
      );

      if (diff <= 180) {
        total += 1;
      }
    }
  }

  return total;
}

function calculateSameDayStudentConflicts(data, assignments, timeSlotsById) {
  const courseToSlot = {};

  for (const assignment of assignments) {
    if (assignment.time_slot_id) {
      courseToSlot[assignment.course_id] = assignment.time_slot_id;
    }
  }

  let affectedStudents = 0;

  for (const courseIds of Object.values(data.coursesByStudent || {})) {
    const examsByDay = {};

    for (const courseId of courseIds) {
      const slotId = courseToSlot[courseId];
      if (!slotId) continue;

      const slot = timeSlotsById[slotId];
      if (!slot) continue;

      const dayKey = String(slot.slot_date);

      if (!examsByDay[dayKey]) {
        examsByDay[dayKey] = 0;
      }

      examsByDay[dayKey] += 1;
    }

    const hasSameDayConflict = Object.values(examsByDay).some(
      (count) => count > 1,
    );

    if (hasSameDayConflict) {
      affectedStudents += 1;
    }
  }

  return affectedStudents;
}

function calculateMaxExamsPerStudentPerDay(data, assignments, timeSlotsById) {
  const courseToSlot = {};

  for (const assignment of assignments) {
    if (assignment.time_slot_id) {
      courseToSlot[assignment.course_id] = assignment.time_slot_id;
    }
  }

  let maxExamsPerDay = 0;

  for (const courseIds of Object.values(data.coursesByStudent || {})) {
    const examsByDay = {};

    for (const courseId of courseIds) {
      const slotId = courseToSlot[courseId];
      if (!slotId) continue;

      const slot = timeSlotsById[slotId];
      if (!slot) continue;

      const dayKey = String(slot.slot_date);
      examsByDay[dayKey] = (examsByDay[dayKey] || 0) + 1;
    }

    for (const count of Object.values(examsByDay)) {
      if (count > maxExamsPerDay) {
        maxExamsPerDay = count;
      }
    }
  }

  return maxExamsPerDay;
}

function calculateInstructorLoadDistribution(assignments, roomAssignments) {
  const primaryLoad = {};
  const supervisorLoad = {};

  for (const assignment of assignments) {
    if (!assignment.primary_instructor_id) continue;
    const id = Number(assignment.primary_instructor_id);
    primaryLoad[id] = (primaryLoad[id] || 0) + 1;
  }

  for (const roomAssignment of roomAssignments) {
    if (!roomAssignment.supervisor_instructor_id) continue;
    const id = Number(roomAssignment.supervisor_instructor_id);
    supervisorLoad[id] = (supervisorLoad[id] || 0) + 1;
  }

  return {
    primaryLoad,
    supervisorLoad,
  };
}

function calculateQualityScore(validationResult, metrics) {
  const hardViolations = Number(
    validationResult?.summary?.hardConstraintViolations || 0,
  );
  const sameDayStudentConflicts = Number(metrics?.sameDayStudentConflicts || 0);
  const closeSameDayStudentConflicts = Number(
    metrics?.closeSameDayStudentConflicts || 0,
  );
  const averageRoomUtilization = Number(metrics?.averageRoomUtilization || 0);
  const totalExams = Number(metrics?.totalExams || 1);
  const maxExamsPerStudentPerDay = Number(
    metrics?.maxExamsPerStudentPerDay || 0,
  );
  const mostCrowdedDayExamCount = Number(
    metrics?.mostCrowdedDay?.examCount || 0,
  );

  let score = 100;

  // Hard constraints should hurt a lot
  score -= hardViolations * 25;

  // Student-centric penalties
  score -= (sameDayStudentConflicts / totalExams) * 4.0;
  score -= (closeSameDayStudentConflicts / totalExams) * 2.0;

  // Extra punishment if any student gets overloaded in one day
  score -= Math.max(0, maxExamsPerStudentPerDay - 2) * 6;

  // Penalize overly crowded peak day
  score -= Math.max(0, mostCrowdedDayExamCount - 6) * 2.5;

  // Mild utilization penalty
  score -= Math.max(0, 0.7 - averageRoomUtilization) * 15;

  return Number(Math.max(0, Math.min(100, score)).toFixed(2));
}

function scoreSchedule(data, instructorAssignmentResult, validationResult) {
  const timeSlotsById = buildTimeSlotsById(data.timeSlots);

  const metrics = {
    totalExams: instructorAssignmentResult.assignments.length,
    scheduledExams: instructorAssignmentResult.assignments.filter(
      (a) => a.time_slot_id,
    ).length,
    averageRoomUtilization: calculateAverageRoomUtilization(
      data,
      instructorAssignmentResult.roomAssignments || [],
    ),
    sameDayStudentConflicts: calculateSameDayStudentConflicts(
      data,
      instructorAssignmentResult.assignments || [],
      timeSlotsById,
    ),
    closeSameDayStudentConflicts: calculateCloseSameDayStudentConflicts(
      data,
      instructorAssignmentResult.assignments || [],
      timeSlotsById,
    ),
    maxExamsPerStudentPerDay: calculateMaxExamsPerStudentPerDay(
      data,
      instructorAssignmentResult.assignments || [],
      timeSlotsById,
    ),
    mostCrowdedDay: calculateMostCrowdedDay(
      instructorAssignmentResult.assignments || [],
      timeSlotsById,
    ),
    instructorLoadDistribution: calculateInstructorLoadDistribution(
      instructorAssignmentResult.assignments || [],
      instructorAssignmentResult.roomAssignments || [],
    ),
  };

  const qualityScore = calculateQualityScore(validationResult, metrics);

  return {
    qualityScore,
    metrics,
  };
}

export default scoreSchedule;
