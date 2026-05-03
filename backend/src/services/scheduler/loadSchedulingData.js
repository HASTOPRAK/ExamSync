import db from "../../config/db.js";

async function loadSchedulingData(examPeriodId, ownerId) {
  if (!examPeriodId) {
    throw new Error("examPeriodId is required");
  }
  if (!ownerId) {
    throw new Error("ownerId is required");
  }

  const examPeriodResult = await db.query(
    `SELECT
      id, name, academic_year, term, exam_type,
      start_date, end_date, status
     FROM exam_periods
     WHERE id = $1 AND owner_id = $2
     LIMIT 1`,
    [examPeriodId, ownerId],
  );

  if (examPeriodResult.rows.length === 0) {
    throw new Error(`Exam period not found: ${examPeriodId}`);
  }

  const examPeriod = examPeriodResult.rows[0];

  const coursesResult = await db.query(
    `SELECT
      c.id,
      c.course_code,
      c.course_name,
      c.exam_duration_minutes,
      c.student_count_cache,
      c.department_id,
      c.is_active
     FROM courses c
     WHERE c.owner_id = $1 AND c.is_active = true
     ORDER BY c.id`,
    [ownerId],
  );

  const roomsResult = await db.query(
    `SELECT
      r.id,
      r.room_code,
      r.building,
      r.capacity,
      r.is_active
     FROM rooms r
     WHERE r.owner_id = $1 AND r.is_active = true
     ORDER BY r.capacity DESC, r.id`,
    [ownerId],
  );

  const timeSlotsResult = await db.query(
    `SELECT
      ts.id,
      ts.exam_period_id,
      ts.slot_date,
      ts.start_time,
      ts.end_time,
      ts.duration_minutes,
      ts.is_active
     FROM time_slots ts
     WHERE ts.exam_period_id = $1 AND ts.is_active = true
     ORDER BY ts.slot_date, ts.start_time, ts.id`,
    [examPeriodId],
  );

  const instructorsResult = await db.query(
    `SELECT
      ci.course_id,
      ci.instructor_id,
      ci.role
     FROM course_instructors ci
     JOIN courses c ON c.id = ci.course_id
     WHERE c.owner_id = $1
     ORDER BY ci.course_id, ci.id`,
    [ownerId],
  );

  const instructorsCatalogResult = await db.query(
    `SELECT
      i.id,
      i.full_name,
      i.email,
      i.department_id,
      i.is_available
     FROM instructors i
     WHERE i.owner_id = $1 AND i.is_available = true
     ORDER BY i.id`,
    [ownerId],
  );

  const examsResult = await db.query(
    `SELECT
      e.id,
      e.course_id,
      e.exam_period_id,
      e.time_slot_id,
      e.primary_instructor_id,
      e.status,
      e.notes
     FROM exams e
     WHERE e.exam_period_id = $1
     ORDER BY e.id`,
    [examPeriodId],
  );

  const enrollmentsResult = await db.query(
    `SELECT
      e.student_id,
      e.course_id
     FROM enrollments e
     INNER JOIN courses c ON c.id = e.course_id
     WHERE c.owner_id = $1 AND c.is_active = true
     ORDER BY e.student_id, e.course_id`,
    [ownerId],
  );

  const courses = coursesResult.rows;
  const rooms = roomsResult.rows;
  const timeSlots = timeSlotsResult.rows;
  const courseInstructors = instructorsResult.rows;
  const instructors = instructorsCatalogResult.rows;
  const exams = examsResult.rows;
  const enrollments = enrollmentsResult.rows;

  const coursesById = {};
  const studentsByCourse = {};
  const coursesByStudent = {};
  const instructorsByCourse = {};
  const examsByCourseId = {};

  for (const course of courses) {
    coursesById[course.id] = {
      ...course,
      student_count: Number(course.student_count_cache || 0),
    };
    studentsByCourse[course.id] = [];
    instructorsByCourse[course.id] = [];
  }

  for (const enrollment of enrollments) {
    const { student_id, course_id } = enrollment;

    if (!studentsByCourse[course_id]) {
      studentsByCourse[course_id] = [];
    }
    studentsByCourse[course_id].push(student_id);

    if (!coursesByStudent[student_id]) {
      coursesByStudent[student_id] = [];
    }
    coursesByStudent[student_id].push(course_id);
  }

  for (const courseId of Object.keys(studentsByCourse)) {
    if (coursesById[courseId]) {
      coursesById[courseId].student_count = studentsByCourse[courseId].length;
    }
  }

  for (const row of courseInstructors) {
    if (!instructorsByCourse[row.course_id]) {
      instructorsByCourse[row.course_id] = [];
    }
    instructorsByCourse[row.course_id].push({
      instructor_id: row.instructor_id,
      role: row.role,
    });
  }

  for (const exam of exams) {
    examsByCourseId[exam.course_id] = exam;
  }

  return {
    examPeriod,
    courses,
    rooms,
    timeSlots,
    exams,
    enrollments,
    courseInstructors,
    instructors,
    coursesById,
    studentsByCourse,
    coursesByStudent,
    instructorsByCourse,
    examsByCourseId,
  };
}

export default loadSchedulingData;
