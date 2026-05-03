function buildConflictGraph(data) {
  const { courses, coursesByStudent } = data;

  const conflictGraph = {};
  const conflictPairs = [];
  const courseMetrics = {};

  for (const course of courses) {
    conflictGraph[course.id] = {};
    courseMetrics[course.id] = {
      course_id: course.id,
      conflict_count: 0,
      total_conflict_weight: 0,
      student_count: Number(
        course.student_count || course.student_count_cache || 0,
      ),
    };
  }

  for (const studentId of Object.keys(coursesByStudent)) {
    const studentCourses = coursesByStudent[studentId];

    if (!studentCourses || studentCourses.length < 2) {
      continue;
    }

    for (let i = 0; i < studentCourses.length; i += 1) {
      for (let j = i + 1; j < studentCourses.length; j += 1) {
        const courseA = studentCourses[i];
        const courseB = studentCourses[j];

        if (!conflictGraph[courseA]) {
          conflictGraph[courseA] = {};
        }

        if (!conflictGraph[courseB]) {
          conflictGraph[courseB] = {};
        }

        conflictGraph[courseA][courseB] =
          (conflictGraph[courseA][courseB] || 0) + 1;
        conflictGraph[courseB][courseA] =
          (conflictGraph[courseB][courseA] || 0) + 1;
      }
    }
  }

  for (const course of courses) {
    const neighbors = conflictGraph[course.id] || {};
    const neighborIds = Object.keys(neighbors);

    courseMetrics[course.id].conflict_count = neighborIds.length;
    courseMetrics[course.id].total_conflict_weight = neighborIds.reduce(
      (sum, neighborId) => sum + neighbors[neighborId],
      0,
    );
  }

  const seenPairs = new Set();

  for (const courseId of Object.keys(conflictGraph)) {
    for (const neighborId of Object.keys(conflictGraph[courseId])) {
      const a = Number(courseId);
      const b = Number(neighborId);
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;

      if (seenPairs.has(key)) {
        continue;
      }

      seenPairs.add(key);

      conflictPairs.push({
        course_id_1: a < b ? a : b,
        course_id_2: a < b ? b : a,
        shared_students: conflictGraph[courseId][neighborId],
      });
    }
  }

  const courseOrder = [...courses]
    .sort((a, b) => {
      const aMetrics = courseMetrics[a.id];
      const bMetrics = courseMetrics[b.id];

      if (bMetrics.conflict_count !== aMetrics.conflict_count) {
        return bMetrics.conflict_count - aMetrics.conflict_count;
      }

      if (bMetrics.total_conflict_weight !== aMetrics.total_conflict_weight) {
        return bMetrics.total_conflict_weight - aMetrics.total_conflict_weight;
      }

      return bMetrics.student_count - aMetrics.student_count;
    })
    .map((course) => ({
      ...course,
      metrics: courseMetrics[course.id],
    }));

  return {
    conflictGraph,
    conflictPairs,
    courseMetrics,
    courseOrder,
    summary: {
      totalCourses: courses.length,
      totalConflictPairs: conflictPairs.length,
      coursesWithConflicts: Object.values(courseMetrics).filter(
        (item) => item.conflict_count > 0,
      ).length,
      coursesWithoutConflicts: Object.values(courseMetrics).filter(
        (item) => item.conflict_count === 0,
      ).length,
      maxConflictWeight: conflictPairs.length
        ? Math.max(...conflictPairs.map((pair) => pair.shared_students))
        : 0,
    },
  };
}

export default buildConflictGraph;
