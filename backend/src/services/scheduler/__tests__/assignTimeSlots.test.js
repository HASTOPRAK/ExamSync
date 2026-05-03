import { describe, it, expect } from "vitest";
import assignTimeSlots from "../assignTimeSlots.js";
import buildConflictGraph from "../buildConflictGraph.js";

// ─── helpers ───────────────────────────────────────────────────────────────

function makeCourse(id, durationMinutes = 90, studentCount = 30) {
  return {
    id,
    course_code: `C${id}`,
    course_name: `Course ${id}`,
    exam_duration_minutes: durationMinutes,
    student_count_cache: studentCount,
    student_count: studentCount,
  };
}

function makeSlot(id, opts = {}) {
  return {
    id,
    slot_date: opts.date ?? "2026-06-01",
    start_time: opts.start ?? "09:00:00",
    end_time: opts.end ?? "11:00:00",
    duration_minutes: opts.duration ?? 120,
    is_active: true,
  };
}

function makeData(courses, slots, opts = {}) {
  const coursesById = Object.fromEntries(courses.map((c) => [c.id, c]));
  return {
    courses,
    coursesById,
    timeSlots: slots,
    examsByCourseId: opts.examsByCourseId ?? {},
    instructorsByCourse: opts.instructorsByCourse ?? {},
  };
}

function graph(courses, coursesByStudent = {}) {
  return buildConflictGraph({ courses, coursesByStudent });
}

// ─── tests ─────────────────────────────────────────────────────────────────

describe("assignTimeSlots", () => {
  describe("empty / trivial inputs", () => {
    it("returns empty result when there are no courses", () => {
      const data = makeData([], [makeSlot(1)]);
      const g = graph([]);
      const result = assignTimeSlots(data, g);

      expect(result.scheduled).toHaveLength(0);
      expect(result.unscheduled).toHaveLength(0);
      expect(result.summary.totalCourses).toBe(0);
      expect(result.summary.scheduledCount).toBe(0);
    });

    it("returns unscheduled when there are no slots", () => {
      const courses = [makeCourse(1)];
      const data = makeData(courses, []);
      const g = graph(courses);
      const result = assignTimeSlots(data, g);

      expect(result.scheduled).toHaveLength(0);
      expect(result.unscheduled).toHaveLength(1);
      expect(result.unscheduled[0].course_id).toBe(1);
    });
  });

  describe("single course scheduling", () => {
    it("schedules a course when a valid slot exists", () => {
      const courses = [makeCourse(1)];
      const slots = [makeSlot(1)];
      const data = makeData(courses, slots);
      const g = graph(courses);
      const result = assignTimeSlots(data, g);

      expect(result.summary.scheduledCount).toBe(1);
      expect(result.summary.unscheduledCount).toBe(0);
      expect(result.scheduled[0].course_id).toBe(1);
      expect(result.scheduled[0].time_slot_id).toBe(1);
    });

    it("leaves a course unscheduled when exam duration exceeds slot duration", () => {
      const courses = [makeCourse(1, 180)]; // 180-min exam
      const slots = [makeSlot(1, { duration: 90 })]; // only 90-min slot
      const data = makeData(courses, slots);
      const g = graph(courses);
      const result = assignTimeSlots(data, g);

      expect(result.scheduled).toHaveLength(0);
      expect(result.unscheduled).toHaveLength(1);
    });
  });

  describe("conflict avoidance", () => {
    it("places conflicting courses in different slots", () => {
      const courses = [makeCourse(1), makeCourse(2)];
      const slots = [
        makeSlot(1, { date: "2026-06-01", start: "09:00:00" }),
        makeSlot(2, { date: "2026-06-02", start: "09:00:00" }),
      ];
      const coursesByStudent = { 101: [1, 2] }; // student in both → conflict
      const data = makeData(courses, slots);
      const g = graph(courses, coursesByStudent);
      const result = assignTimeSlots(data, g);

      expect(result.summary.scheduledCount).toBe(2);
      const slotForCourse1 = result.scheduled.find(
        (s) => s.course_id === 1,
      )?.time_slot_id;
      const slotForCourse2 = result.scheduled.find(
        (s) => s.course_id === 2,
      )?.time_slot_id;
      expect(slotForCourse1).not.toBe(slotForCourse2);
    });

    it("leaves a conflicting course unscheduled when only one slot is available", () => {
      const courses = [makeCourse(1), makeCourse(2)];
      const slots = [makeSlot(1)]; // only one slot
      const coursesByStudent = { 101: [1, 2] };
      const data = makeData(courses, slots);
      const g = graph(courses, coursesByStudent);
      const result = assignTimeSlots(data, g);

      expect(result.summary.scheduledCount).toBe(1);
      expect(result.summary.unscheduledCount).toBe(1);
    });

    it("avoids instructor conflicts: same instructor cannot be in two courses at same slot", () => {
      const courses = [makeCourse(1), makeCourse(2)];
      const slots = [
        makeSlot(1, { date: "2026-06-01", start: "09:00:00" }),
        makeSlot(2, { date: "2026-06-02", start: "09:00:00" }),
      ];
      // Both courses have the same primary instructor (id: 99)
      const instructorsByCourse = {
        1: [{ instructor_id: 99, role: "primary" }],
        2: [{ instructor_id: 99, role: "primary" }],
      };
      const data = makeData(courses, slots, { instructorsByCourse });
      const g = graph(courses, {}); // no student conflicts
      const result = assignTimeSlots(data, g);

      expect(result.summary.scheduledCount).toBe(2);
      const slot1 = result.scheduled.find((s) => s.course_id === 1)?.time_slot_id;
      const slot2 = result.scheduled.find((s) => s.course_id === 2)?.time_slot_id;
      expect(slot1).not.toBe(slot2);
    });
  });

  describe("return structure", () => {
    it("populates examsBySlot grouping correctly", () => {
      const courses = [makeCourse(1), makeCourse(2)];
      const slots = [makeSlot(1)];
      const data = makeData(courses, slots);
      const g = graph(courses, {});
      const result = assignTimeSlots(data, g);

      // Both non-conflicting courses should land in slot 1
      expect(Object.keys(result.examsBySlot)).toContain("1");
      expect(result.examsBySlot[1]).toHaveLength(2);
    });

    it("includes slot_date, start_time, end_time on each scheduled item", () => {
      const courses = [makeCourse(1)];
      const slots = [makeSlot(1, { date: "2026-06-10", start: "10:00:00", end: "12:00:00" })];
      const data = makeData(courses, slots);
      const g = graph(courses);
      const result = assignTimeSlots(data, g);

      const item = result.scheduled[0];
      expect(item.slot_date).toBe("2026-06-10");
      expect(item.start_time).toBe("10:00:00");
      expect(item.end_time).toBe("12:00:00");
    });

    it("summary counts match actual arrays", () => {
      const courses = [makeCourse(1), makeCourse(2), makeCourse(3)];
      const slots = [
        makeSlot(1, { date: "2026-06-01" }),
        makeSlot(2, { date: "2026-06-02" }),
      ];
      // courses 1 and 2 conflict, course 3 is free
      const data = makeData(courses, slots, {
        instructorsByCourse: {},
      });
      const g = graph(courses, { 101: [1, 2] });
      const result = assignTimeSlots(data, g);

      expect(result.summary.scheduledCount).toBe(result.scheduled.length);
      expect(result.summary.unscheduledCount).toBe(result.unscheduled.length);
      expect(result.summary.totalCourses).toBe(courses.length);
    });
  });
});
