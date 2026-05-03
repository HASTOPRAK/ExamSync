function sortRoomsForGreedyAssignment(rooms) {
  return [...rooms].sort((a, b) => Number(a.capacity) - Number(b.capacity));
}

function sortExamsForRoomAssignment(assignments, coursesById) {
  return [...assignments]
    .filter((item) => item.time_slot_id)
    .sort((a, b) => {
      const aStudents = Number(coursesById[a.course_id]?.student_count || 0);
      const bStudents = Number(coursesById[b.course_id]?.student_count || 0);

      if (bStudents !== aStudents) {
        return bStudents - aStudents;
      }

      return a.course_id - b.course_id;
    });
}

function groupAssignmentsBySlot(assignments) {
  const grouped = {};

  for (const assignment of assignments) {
    if (!assignment.time_slot_id) continue;

    if (!grouped[assignment.time_slot_id]) {
      grouped[assignment.time_slot_id] = [];
    }

    grouped[assignment.time_slot_id].push(assignment);
  }

  return grouped;
}

function createRoomUsageMap(timeSlots) {
  const roomUsageBySlot = {};

  for (const slot of timeSlots) {
    roomUsageBySlot[slot.id] = new Set();
  }

  return roomUsageBySlot;
}

function pickSingleBestRoom(availableRooms, requiredCapacity) {
  return (
    availableRooms.find((room) => Number(room.capacity) >= requiredCapacity) ||
    null
  );
}

function pickMultipleRooms(availableRooms, requiredCapacity) {
  const selectedRooms = [];
  let totalCapacity = 0;

  for (const room of [...availableRooms].sort(
    (a, b) => Number(b.capacity) - Number(a.capacity),
  )) {
    selectedRooms.push(room);
    totalCapacity += Number(room.capacity);

    if (totalCapacity >= requiredCapacity) {
      return {
        selectedRooms,
        totalCapacity,
      };
    }
  }

  return null;
}

function assignRooms(data, slotAssignmentResult) {
  const { rooms, timeSlots, coursesById } = data;
  const slotAssignments = slotAssignmentResult.assignments;

  const sortedRooms = sortRoomsForGreedyAssignment(rooms);
  const groupedBySlot = groupAssignmentsBySlot(slotAssignments);
  const roomUsageBySlot = createRoomUsageMap(timeSlots);

  const roomAssignments = [];
  const roomlessExams = [];

  for (const [slotIdRaw, assignmentsInSlot] of Object.entries(groupedBySlot)) {
    const slotId = Number(slotIdRaw);

    const sortedExams = sortExamsForRoomAssignment(
      assignmentsInSlot,
      coursesById,
    );

    for (const assignment of sortedExams) {
      const course = coursesById[assignment.course_id];
      const requiredCapacity = Number(course?.student_count || 0);

      if (requiredCapacity <= 0) {
        roomlessExams.push({
          exam_id: assignment.exam_id,
          course_id: assignment.course_id,
          course_code: course?.course_code,
          course_name: course?.course_name,
          time_slot_id: slotId,
          reason: "Course has zero students or invalid student count",
        });

        continue;
      }

      const usedRoomIds = roomUsageBySlot[slotId] || new Set();

      const availableRooms = sortedRooms.filter(
        (room) => !usedRoomIds.has(room.id) && room.is_active === true,
      );

      if (availableRooms.length === 0) {
        roomlessExams.push({
          exam_id: assignment.exam_id,
          course_id: assignment.course_id,
          course_code: course?.course_code,
          course_name: course?.course_name,
          time_slot_id: slotId,
          reason: "No rooms available in this slot",
        });

        continue;
      }

      const singleRoom = pickSingleBestRoom(availableRooms, requiredCapacity);

      if (singleRoom) {
        roomAssignments.push({
          exam_id: assignment.exam_id,
          course_id: assignment.course_id,
          time_slot_id: slotId,
          room_id: singleRoom.id,
          room_code: singleRoom.room_code,
          building: singleRoom.building,
          assigned_capacity: requiredCapacity,
          room_capacity: Number(singleRoom.capacity),
          supervisor_instructor_id: null,
        });

        roomUsageBySlot[slotId].add(singleRoom.id);
        continue;
      }

      const multiRoomResult = pickMultipleRooms(
        availableRooms,
        requiredCapacity,
      );

      if (!multiRoomResult) {
        roomlessExams.push({
          exam_id: assignment.exam_id,
          course_id: assignment.course_id,
          course_code: course?.course_code,
          course_name: course?.course_name,
          time_slot_id: slotId,
          reason: "Insufficient total room capacity in this slot",
        });

        continue;
      }

      let remaining = requiredCapacity;

      for (const room of multiRoomResult.selectedRooms) {
        if (remaining <= 0) break;

        const assignedCapacity = Math.min(Number(room.capacity), remaining);

        roomAssignments.push({
          exam_id: assignment.exam_id,
          course_id: assignment.course_id,
          time_slot_id: slotId,
          room_id: room.id,
          room_code: room.room_code,
          building: room.building,
          assigned_capacity: assignedCapacity,
          room_capacity: Number(room.capacity),
          supervisor_instructor_id: null,
        });

        roomUsageBySlot[slotId].add(room.id);
        remaining -= assignedCapacity;
      }
    }
  }

  const roomAssignmentsByExamId = {};

  for (const item of roomAssignments) {
    if (!roomAssignmentsByExamId[item.exam_id]) {
      roomAssignmentsByExamId[item.exam_id] = [];
    }

    roomAssignmentsByExamId[item.exam_id].push(item);
  }

  const updatedAssignments = slotAssignments.map((assignment) => {
    const assignedRooms = roomAssignmentsByExamId[assignment.exam_id] || [];
    const hasRooms = assignedRooms.length > 0;

    return {
      ...assignment,
      status: !assignment.time_slot_id
        ? "unscheduled"
        : hasRooms
          ? "scheduled"
          : "room_unassigned",
    };
  });

  return {
    assignments: updatedAssignments,
    roomAssignments,
    roomlessExams,
    summary: {
      totalScheduledExams: slotAssignments.filter((item) => item.time_slot_id)
        .length,
      examsWithRooms: Object.keys(roomAssignmentsByExamId).length,
      examsWithoutRooms: roomlessExams.length,
      roomAssignmentsCreated: roomAssignments.length,
    },
  };
}

export default assignRooms;
