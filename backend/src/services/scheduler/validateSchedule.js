function buildExamMaps(data, instructorAssignmentResult) {
  const { exams, coursesById, timeSlots, instructorsByCourse } = data;

  const examsById = {};
  const timeSlotsById = {};
  const roomsByExamId = {};
  const finalAssignmentsByCourseId = {};

  for (const exam of exams) {
    examsById[exam.id] = exam;
  }

  for (const slot of timeSlots) {
    timeSlotsById[slot.id] = slot;
  }

  for (const roomAssignment of instructorAssignmentResult.roomAssignments ||
    []) {
    if (!roomsByExamId[roomAssignment.exam_id]) {
      roomsByExamId[roomAssignment.exam_id] = [];
    }
    roomsByExamId[roomAssignment.exam_id].push(roomAssignment);
  }

  for (const assignment of instructorAssignmentResult.assignments || []) {
    finalAssignmentsByCourseId[assignment.course_id] = assignment;
  }

  return {
    examsById,
    timeSlotsById,
    roomsByExamId,
    finalAssignmentsByCourseId,
  };
}

function validateUnscheduledExams(data, instructorAssignmentResult) {
  const issues = [];

  for (const assignment of instructorAssignmentResult.assignments || []) {
    if (!assignment.time_slot_id) {
      const course = data.coursesById[assignment.course_id];

      issues.push({
        type: "UNSCHEDULED_EXAM",
        severity: "error",
        course_id: assignment.course_id,
        course_code: course?.course_code,
        course_name: course?.course_name,
        message: "Exam has no assigned time slot",
      });
    }
  }

  return issues;
}

function validateExamPeriodMatch(data, instructorAssignmentResult) {
  const issues = [];
  const examPeriodId = Number(data.examPeriod.id);

  for (const assignment of instructorAssignmentResult.assignments || []) {
    const exam = data.examsByCourseId[assignment.course_id];
    const course = data.coursesById[assignment.course_id];

    if (!exam) {
      issues.push({
        type: "MISSING_EXAM_RECORD",
        severity: "error",
        course_id: assignment.course_id,
        course_code: course?.course_code,
        course_name: course?.course_name,
        message: "Course has no exam record in this exam period",
      });
      continue;
    }

    if (Number(exam.exam_period_id) !== examPeriodId) {
      issues.push({
        type: "WRONG_EXAM_PERIOD",
        severity: "error",
        course_id: assignment.course_id,
        course_code: course?.course_code,
        course_name: course?.course_name,
        message: "Exam belongs to a different exam period",
      });
    }
  }

  return issues;
}

function validateDurationFit(data, instructorAssignmentResult) {
  const issues = [];
  const timeSlotsById = Object.fromEntries(
    data.timeSlots.map((slot) => [slot.id, slot]),
  );

  for (const assignment of instructorAssignmentResult.assignments || []) {
    if (!assignment.time_slot_id) continue;

    const course = data.coursesById[assignment.course_id];
    const slot = timeSlotsById[assignment.time_slot_id];

    if (!course || !slot) continue;

    if (Number(course.exam_duration_minutes) > Number(slot.duration_minutes)) {
      issues.push({
        type: "EXAM_DURATION_EXCEEDS_SLOT",
        severity: "error",
        course_id: assignment.course_id,
        course_code: course.course_code,
        course_name: course.course_name,
        time_slot_id: slot.id,
        message: "Exam duration exceeds slot duration",
      });
    }
  }

  return issues;
}

function validateRoomCapacity(data, instructorAssignmentResult) {
  const issues = [];

  // Key by course_id — exam_id is null for fresh schedules, which would
  // cause all room assignments to collapse under a single null key.
  const roomAssignmentsByCourseId = {};

  for (const roomAssignment of instructorAssignmentResult.roomAssignments ||
    []) {
    const key = Number(roomAssignment.course_id);
    if (!roomAssignmentsByCourseId[key]) {
      roomAssignmentsByCourseId[key] = [];
    }
    roomAssignmentsByCourseId[key].push(roomAssignment);
  }

  for (const assignment of instructorAssignmentResult.assignments || []) {
    if (!assignment.course_id || !assignment.time_slot_id) continue;

    const course = data.coursesById[assignment.course_id];
    const roomAssignments = roomAssignmentsByCourseId[Number(assignment.course_id)] || [];
    const totalAssignedCapacity = roomAssignments.reduce(
      (sum, item) => sum + Number(item.assigned_capacity || 0),
      0,
    );

    const requiredCapacity = Number(course?.student_count || 0);

    if (requiredCapacity <= 0) {
      issues.push({
        type: "INVALID_STUDENT_COUNT",
        severity: "warning",
        course_id: assignment.course_id,
        course_code: course?.course_code,
        course_name: course?.course_name,
        message: "Course student count is zero or invalid",
      });
      continue;
    }

    if (totalAssignedCapacity < requiredCapacity) {
      issues.push({
        type: "INSUFFICIENT_ROOM_CAPACITY",
        severity: "error",
        course_id: assignment.course_id,
        course_code: course?.course_code,
        course_name: course?.course_name,
        exam_id: assignment.exam_id,
        required_capacity: requiredCapacity,
        assigned_capacity: totalAssignedCapacity,
        message: "Assigned room capacity is lower than enrolled student count",
      });
    }
  }

  return issues;
}

function validateRoomDoubleBooking(instructorAssignmentResult) {
  const issues = [];
  const roomSlotUsage = new Map();

  for (const roomAssignment of instructorAssignmentResult.roomAssignments ||
    []) {
    const key = `${roomAssignment.time_slot_id}-${roomAssignment.room_id}`;

    if (!roomSlotUsage.has(key)) {
      roomSlotUsage.set(key, []);
    }

    roomSlotUsage.get(key).push(roomAssignment);
  }

  for (const [key, assignments] of roomSlotUsage.entries()) {
    if (assignments.length <= 1) continue;

    issues.push({
      type: "ROOM_DOUBLE_BOOKED",
      severity: "error",
      key,
      room_id: assignments[0].room_id,
      time_slot_id: assignments[0].time_slot_id,
      exam_ids: assignments.map((item) => item.exam_id),
      message: "Room is assigned to multiple exams in the same slot",
    });
  }

  return issues;
}

function validateInstructorDoubleBooking(instructorAssignmentResult) {
  const issues = [];
  const instructorSlotUsage = new Map();

  for (const assignment of instructorAssignmentResult.assignments || []) {
    if (!assignment.time_slot_id || !assignment.primary_instructor_id) continue;

    const key = `${assignment.time_slot_id}-${assignment.primary_instructor_id}`;

    if (!instructorSlotUsage.has(key)) {
      instructorSlotUsage.set(key, []);
    }

    instructorSlotUsage.get(key).push({
      role: "primary",
      exam_id: assignment.exam_id,
      course_id: assignment.course_id,
    });
  }

  for (const roomAssignment of instructorAssignmentResult.roomAssignments ||
    []) {
    if (
      !roomAssignment.time_slot_id ||
      !roomAssignment.supervisor_instructor_id
    )
      continue;

    const key = `${roomAssignment.time_slot_id}-${roomAssignment.supervisor_instructor_id}`;

    if (!instructorSlotUsage.has(key)) {
      instructorSlotUsage.set(key, []);
    }

    instructorSlotUsage.get(key).push({
      role: "supervisor",
      exam_id: roomAssignment.exam_id,
      room_id: roomAssignment.room_id,
    });
  }

  for (const [key, usages] of instructorSlotUsage.entries()) {
    if (usages.length <= 1) continue;

    issues.push({
      type: "INSTRUCTOR_DOUBLE_BOOKED",
      severity: "error",
      key,
      usages,
      message: "Instructor is assigned more than once in the same slot",
    });
  }

  return issues;
}

function validateStudentOverlaps(data, instructorAssignmentResult) {
  const issues = [];
  const courseToSlot = {};

  for (const assignment of instructorAssignmentResult.assignments || []) {
    if (assignment.time_slot_id) {
      courseToSlot[assignment.course_id] = assignment.time_slot_id;
    }
  }

  for (const [studentId, courseIds] of Object.entries(
    data.coursesByStudent || {},
  )) {
    const slotMap = new Map();

    for (const courseId of courseIds) {
      const slotId = courseToSlot[courseId];
      if (!slotId) continue;

      if (!slotMap.has(slotId)) {
        slotMap.set(slotId, []);
      }

      slotMap.get(slotId).push(Number(courseId));
    }

    for (const [slotId, conflictingCourses] of slotMap.entries()) {
      if (conflictingCourses.length > 1) {
        issues.push({
          type: "STUDENT_OVERLAP",
          severity: "error",
          student_id: Number(studentId),
          time_slot_id: Number(slotId),
          course_ids: conflictingCourses,
          message: "Student has multiple exams in the same slot",
        });
      }
    }
  }

  return issues;
}

function validateSchedule(data, instructorAssignmentResult) {
  const issues = [
    ...validateUnscheduledExams(data, instructorAssignmentResult),
    ...validateDurationFit(data, instructorAssignmentResult),
    ...validateRoomCapacity(data, instructorAssignmentResult),
    ...validateRoomDoubleBooking(instructorAssignmentResult),
    ...validateInstructorDoubleBooking(instructorAssignmentResult),
    ...validateStudentOverlaps(data, instructorAssignmentResult),
  ];

  const hardConstraintViolations = issues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const warnings = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;

  return {
    isValid: hardConstraintViolations === 0,
    summary: {
      totalIssues: issues.length,
      hardConstraintViolations,
      warnings,
    },
    issues,
  };
}

export default validateSchedule;
