function getPrimaryCourseInstructor(instructorsByCourse, courseId) {
  const courseInstructors = instructorsByCourse[courseId] || [];
  return courseInstructors.find((item) => item.role === "primary") || null;
}

function buildInstructorUsageMaps(
  slotAssignments,
  roomAssignments,
  instructorsByCourse,
) {
  const primaryUsageBySlot = {};
  const supervisorUsageBySlot = {};

  for (const assignment of slotAssignments) {
    if (!assignment.time_slot_id || !assignment.primary_instructor_id) continue;

    if (!primaryUsageBySlot[assignment.time_slot_id]) {
      primaryUsageBySlot[assignment.time_slot_id] = new Set();
    }

    primaryUsageBySlot[assignment.time_slot_id].add(
      Number(assignment.primary_instructor_id),
    );
  }

  for (const roomAssignment of roomAssignments) {
    if (
      !roomAssignment.time_slot_id ||
      !roomAssignment.supervisor_instructor_id
    )
      continue;

    if (!supervisorUsageBySlot[roomAssignment.time_slot_id]) {
      supervisorUsageBySlot[roomAssignment.time_slot_id] = new Set();
    }

    supervisorUsageBySlot[roomAssignment.time_slot_id].add(
      Number(roomAssignment.supervisor_instructor_id),
    );
  }

  return {
    primaryUsageBySlot,
    supervisorUsageBySlot,
  };
}

function buildSupervisorLoadMap(roomAssignments) {
  const loadMap = {};

  for (const roomAssignment of roomAssignments) {
    if (!roomAssignment.supervisor_instructor_id) continue;

    const instructorId = Number(roomAssignment.supervisor_instructor_id);
    loadMap[instructorId] = (loadMap[instructorId] || 0) + 1;
  }

  return loadMap;
}

function isInstructorBusyInSlot({
  instructorId,
  timeSlotId,
  primaryUsageBySlot,
  supervisorUsageBySlot,
}) {
  const primaryBusy =
    primaryUsageBySlot[timeSlotId]?.has(Number(instructorId)) || false;
  const supervisorBusy =
    supervisorUsageBySlot[timeSlotId]?.has(Number(instructorId)) || false;

  return primaryBusy || supervisorBusy;
}

function pickSupervisor({
  instructors,
  course,
  timeSlotId,
  primaryInstructorId,
  primaryUsageBySlot,
  supervisorUsageBySlot,
  currentSupervisorLoad,
}) {
  const sameDepartmentCandidates = instructors.filter(
    (instructor) =>
      Number(instructor.department_id) === Number(course.department_id) &&
      Number(instructor.id) !== Number(primaryInstructorId),
  );

  const otherCandidates = instructors.filter(
    (instructor) => Number(instructor.id) !== Number(primaryInstructorId),
  );

  const orderedCandidates = [...sameDepartmentCandidates, ...otherCandidates]
    .filter(
      (candidate, index, self) =>
        self.findIndex((x) => x.id === candidate.id) === index,
    )
    .sort((a, b) => {
      const aLoad = currentSupervisorLoad[Number(a.id)] || 0;
      const bLoad = currentSupervisorLoad[Number(b.id)] || 0;

      if (aLoad !== bLoad) {
        return aLoad - bLoad;
      }

      return Number(a.id) - Number(b.id);
    });

  for (const candidate of orderedCandidates) {
    if (
      !isInstructorBusyInSlot({
        instructorId: candidate.id,
        timeSlotId,
        primaryUsageBySlot,
        supervisorUsageBySlot,
      })
    ) {
      return candidate;
    }
  }

  return null;
}

function assignInstructors(data, slotAssignmentResult, roomAssignmentResult) {
  const { instructors, coursesById, instructorsByCourse } = data;

  const updatedSlotAssignments = slotAssignmentResult.assignments.map(
    (assignment) => {
      const primary = getPrimaryCourseInstructor(
        instructorsByCourse,
        assignment.course_id,
      );

      return {
        ...assignment,
        primary_instructor_id: primary
          ? primary.instructor_id
          : assignment.primary_instructor_id,
      };
    },
  );

  const updatedRoomAssignments = roomAssignmentResult.roomAssignments.map(
    (item) => ({
      ...item,
      supervisor_instructor_id: null,
    }),
  );

  const { primaryUsageBySlot, supervisorUsageBySlot } =
    buildInstructorUsageMaps(
      updatedSlotAssignments,
      updatedRoomAssignments,
      instructorsByCourse,
    );

  const supervisorLoad = buildSupervisorLoadMap(updatedRoomAssignments);
  const supervisorlessRooms = [];

  for (const roomAssignment of updatedRoomAssignments) {
    const course = coursesById[roomAssignment.course_id];
    const slotAssignment = updatedSlotAssignments.find(
      (item) => Number(item.course_id) === Number(roomAssignment.course_id),
    );

    const primaryInstructorId = slotAssignment?.primary_instructor_id || null;

    const supervisor = pickSupervisor({
      instructors,
      course,
      timeSlotId: roomAssignment.time_slot_id,
      primaryInstructorId,
      primaryUsageBySlot,
      supervisorUsageBySlot,
      currentSupervisorLoad: supervisorLoad,
    });

    if (!supervisor) {
      supervisorlessRooms.push({
        exam_id: roomAssignment.exam_id,
        course_id: roomAssignment.course_id,
        course_code: course?.course_code,
        course_name: course?.course_name,
        room_id: roomAssignment.room_id,
        room_code: roomAssignment.room_code,
        time_slot_id: roomAssignment.time_slot_id,
        reason: "No available supervisor for this room and slot",
      });

      continue;
    }

    roomAssignment.supervisor_instructor_id = supervisor.id;

    if (!supervisorUsageBySlot[roomAssignment.time_slot_id]) {
      supervisorUsageBySlot[roomAssignment.time_slot_id] = new Set();
    }

    supervisorUsageBySlot[roomAssignment.time_slot_id].add(
      Number(supervisor.id),
    );
    supervisorLoad[Number(supervisor.id)] =
      (supervisorLoad[Number(supervisor.id)] || 0) + 1;
  }

  const roomAssignmentsByExamId = {};
  for (const item of updatedRoomAssignments) {
    if (!roomAssignmentsByExamId[item.exam_id]) {
      roomAssignmentsByExamId[item.exam_id] = [];
    }
    roomAssignmentsByExamId[item.exam_id].push(item);
  }

  const finalAssignments = updatedSlotAssignments.map((assignment) => {
    const examRooms = roomAssignmentsByExamId[assignment.exam_id] || [];
    const hasRooms = examRooms.length > 0;
    const allRoomsHaveSupervisors =
      hasRooms && examRooms.every((room) => room.supervisor_instructor_id);

    let status = assignment.status;

    if (!assignment.time_slot_id) {
      status = "unscheduled";
    } else if (!hasRooms) {
      status = "room_unassigned";
    } else if (!allRoomsHaveSupervisors) {
      status = "supervisor_unassigned";
    } else {
      status = "scheduled";
    }

    return {
      ...assignment,
      status,
    };
  });

  return {
    assignments: finalAssignments,
    roomAssignments: updatedRoomAssignments,
    supervisorlessRooms,
    summary: {
      examsWithPrimaryInstructor: finalAssignments.filter(
        (a) => a.primary_instructor_id,
      ).length,
      roomAssignmentsWithSupervisor: updatedRoomAssignments.filter(
        (r) => r.supervisor_instructor_id,
      ).length,
      roomAssignmentsWithoutSupervisor: supervisorlessRooms.length,
    },
  };
}

export default assignInstructors;
