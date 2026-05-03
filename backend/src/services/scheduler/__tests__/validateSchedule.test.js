import { describe, it, expect } from "vitest";
import validateSchedule from "../validateSchedule.js";

// ─── helpers ───────────────────────────────────────────────────────────────

function makeData(opts = {}) {
  return {
    examPeriod: { id: 1 },
    exams: opts.exams ?? [],
    coursesById: opts.coursesById ?? {},
    timeSlots: opts.timeSlots ?? [],
    instructorsByCourse: opts.instructorsByCourse ?? {},
    coursesByStudent: opts.coursesByStudent ?? {},
    examsByCourseId: opts.examsByCourseId ?? {},
  };
}

function makeAssignmentResult(opts = {}) {
  return {
    assignments: opts.assignments ?? [],
    roomAssignments: opts.roomAssignments ?? [],
  };
}

// ─── tests ─────────────────────────────────────────────────────────────────

describe("validateSchedule", () => {
  describe("clean schedule", () => {
    it("returns isValid: true with zero issues for an empty schedule", () => {
      const result = validateSchedule(makeData(), makeAssignmentResult());

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.summary.hardConstraintViolations).toBe(0);
      expect(result.summary.warnings).toBe(0);
    });

    it("returns isValid: true for a properly scheduled exam", () => {
      const coursesById = {
        1: {
          id: 1,
          course_code: "CS101",
          course_name: "Intro",
          exam_duration_minutes: 90,
          student_count: 20,
        },
      };
      const timeSlots = [
        { id: 10, slot_date: "2026-06-01", start_time: "09:00", end_time: "11:00", duration_minutes: 120 },
      ];
      const data = makeData({
        coursesById,
        timeSlots,
        examsByCourseId: { 1: { id: 100, exam_period_id: 1 } },
      });
      const result = validateSchedule(
        data,
        makeAssignmentResult({
          assignments: [
            { course_id: 1, time_slot_id: 10, exam_id: 100, primary_instructor_id: null },
          ],
          roomAssignments: [
            {
              exam_id: 100,
              room_id: 5,
              time_slot_id: 10,
              assigned_capacity: 25,
              supervisor_instructor_id: null,
            },
          ],
        }),
      );

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe("UNSCHEDULED_EXAM", () => {
    it("flags an error when an assignment has no time_slot_id", () => {
      const coursesById = {
        1: { id: 1, course_code: "CS101", course_name: "Intro" },
      };
      const data = makeData({ coursesById });
      const result = validateSchedule(
        data,
        makeAssignmentResult({
          assignments: [{ course_id: 1, time_slot_id: null }],
        }),
      );

      expect(result.isValid).toBe(false);
      const issue = result.issues.find((i) => i.type === "UNSCHEDULED_EXAM");
      expect(issue).toBeDefined();
      expect(issue.severity).toBe("error");
    });
  });

  describe("EXAM_DURATION_EXCEEDS_SLOT", () => {
    it("flags an error when exam duration exceeds slot duration", () => {
      const coursesById = {
        1: { id: 1, course_code: "CS101", course_name: "Intro", exam_duration_minutes: 180 },
      };
      const timeSlots = [{ id: 10, duration_minutes: 90 }];
      const data = makeData({ coursesById, timeSlots });
      const result = validateSchedule(
        data,
        makeAssignmentResult({
          assignments: [{ course_id: 1, time_slot_id: 10, exam_id: 100, primary_instructor_id: null }],
        }),
      );

      const issue = result.issues.find(
        (i) => i.type === "EXAM_DURATION_EXCEEDS_SLOT",
      );
      expect(issue).toBeDefined();
      expect(issue.severity).toBe("error");
    });
  });

  describe("ROOM_DOUBLE_BOOKED", () => {
    it("flags an error when a room is assigned to two exams in the same slot", () => {
      const data = makeData();
      const result = validateSchedule(
        data,
        makeAssignmentResult({
          roomAssignments: [
            { exam_id: 1, room_id: 5, time_slot_id: 10, assigned_capacity: 30, supervisor_instructor_id: null },
            { exam_id: 2, room_id: 5, time_slot_id: 10, assigned_capacity: 30, supervisor_instructor_id: null },
          ],
        }),
      );

      const issue = result.issues.find((i) => i.type === "ROOM_DOUBLE_BOOKED");
      expect(issue).toBeDefined();
      expect(issue.severity).toBe("error");
      expect(issue.room_id).toBe(5);
    });

    it("does NOT flag double booking when same room is in different slots", () => {
      const data = makeData();
      const result = validateSchedule(
        data,
        makeAssignmentResult({
          roomAssignments: [
            { exam_id: 1, room_id: 5, time_slot_id: 10, assigned_capacity: 30, supervisor_instructor_id: null },
            { exam_id: 2, room_id: 5, time_slot_id: 11, assigned_capacity: 30, supervisor_instructor_id: null },
          ],
        }),
      );

      const issue = result.issues.find((i) => i.type === "ROOM_DOUBLE_BOOKED");
      expect(issue).toBeUndefined();
    });
  });

  describe("INSTRUCTOR_DOUBLE_BOOKED", () => {
    it("flags an error when a primary instructor is on two courses in the same slot", () => {
      const data = makeData();
      const result = validateSchedule(
        data,
        makeAssignmentResult({
          assignments: [
            { course_id: 1, time_slot_id: 10, exam_id: 100, primary_instructor_id: 99 },
            { course_id: 2, time_slot_id: 10, exam_id: 101, primary_instructor_id: 99 },
          ],
        }),
      );

      const issue = result.issues.find(
        (i) => i.type === "INSTRUCTOR_DOUBLE_BOOKED",
      );
      expect(issue).toBeDefined();
      expect(issue.severity).toBe("error");
    });

    it("does NOT flag an instructor who appears in different slots", () => {
      const data = makeData();
      const result = validateSchedule(
        data,
        makeAssignmentResult({
          assignments: [
            { course_id: 1, time_slot_id: 10, exam_id: 100, primary_instructor_id: 99 },
            { course_id: 2, time_slot_id: 11, exam_id: 101, primary_instructor_id: 99 },
          ],
        }),
      );

      const issue = result.issues.find(
        (i) => i.type === "INSTRUCTOR_DOUBLE_BOOKED",
      );
      expect(issue).toBeUndefined();
    });
  });

  describe("STUDENT_OVERLAP", () => {
    it("flags an error when a student has two exams in the same slot", () => {
      const data = makeData({
        coursesByStudent: {
          201: [1, 2], // student 201 enrolled in both courses
        },
      });
      const result = validateSchedule(
        data,
        makeAssignmentResult({
          assignments: [
            { course_id: 1, time_slot_id: 10, exam_id: 100, primary_instructor_id: null },
            { course_id: 2, time_slot_id: 10, exam_id: 101, primary_instructor_id: null },
          ],
        }),
      );

      const issue = result.issues.find((i) => i.type === "STUDENT_OVERLAP");
      expect(issue).toBeDefined();
      expect(issue.severity).toBe("error");
      expect(issue.student_id).toBe(201);
    });

    it("does NOT flag a student whose exams are in different slots", () => {
      const data = makeData({
        coursesByStudent: { 201: [1, 2] },
      });
      const result = validateSchedule(
        data,
        makeAssignmentResult({
          assignments: [
            { course_id: 1, time_slot_id: 10, exam_id: 100, primary_instructor_id: null },
            { course_id: 2, time_slot_id: 11, exam_id: 101, primary_instructor_id: null },
          ],
        }),
      );

      const issue = result.issues.find((i) => i.type === "STUDENT_OVERLAP");
      expect(issue).toBeUndefined();
    });
  });

  describe("INVALID_STUDENT_COUNT (warning)", () => {
    it("flags a warning when a course has student_count = 0", () => {
      const coursesById = {
        1: { id: 1, course_code: "CS101", course_name: "Intro", student_count: 0 },
      };
      const data = makeData({
        coursesById,
        examsByCourseId: { 1: { id: 100, exam_period_id: 1 } },
      });
      const result = validateSchedule(
        data,
        makeAssignmentResult({
          assignments: [
            { course_id: 1, time_slot_id: 10, exam_id: 100, primary_instructor_id: null },
          ],
          roomAssignments: [
            { exam_id: 100, room_id: 5, time_slot_id: 10, assigned_capacity: 30, supervisor_instructor_id: null },
          ],
        }),
      );

      const issue = result.issues.find((i) => i.type === "INVALID_STUDENT_COUNT");
      expect(issue).toBeDefined();
      expect(issue.severity).toBe("warning");
      // Warnings must not make the schedule invalid
      expect(result.isValid).toBe(true);
    });
  });

  describe("INSUFFICIENT_ROOM_CAPACITY", () => {
    it("flags an error when room capacity is less than student count", () => {
      const coursesById = {
        1: { id: 1, course_code: "CS101", course_name: "Intro", student_count: 50 },
      };
      const data = makeData({ coursesById });
      const result = validateSchedule(
        data,
        makeAssignmentResult({
          assignments: [
            { course_id: 1, time_slot_id: 10, exam_id: 100, primary_instructor_id: null },
          ],
          roomAssignments: [
            { exam_id: 100, room_id: 5, time_slot_id: 10, assigned_capacity: 30, supervisor_instructor_id: null },
          ],
        }),
      );

      const issue = result.issues.find(
        (i) => i.type === "INSUFFICIENT_ROOM_CAPACITY",
      );
      expect(issue).toBeDefined();
      expect(issue.severity).toBe("error");
      expect(issue.required_capacity).toBe(50);
      expect(issue.assigned_capacity).toBe(30);
    });

    it("does NOT flag when capacity exactly meets student count", () => {
      const coursesById = {
        1: { id: 1, course_code: "CS101", course_name: "Intro", student_count: 30 },
      };
      const data = makeData({ coursesById });
      const result = validateSchedule(
        data,
        makeAssignmentResult({
          assignments: [
            { course_id: 1, time_slot_id: 10, exam_id: 100, primary_instructor_id: null },
          ],
          roomAssignments: [
            { exam_id: 100, room_id: 5, time_slot_id: 10, assigned_capacity: 30, supervisor_instructor_id: null },
          ],
        }),
      );

      const issue = result.issues.find(
        (i) => i.type === "INSUFFICIENT_ROOM_CAPACITY",
      );
      expect(issue).toBeUndefined();
    });
  });

  describe("summary counts", () => {
    it("hardConstraintViolations only counts severity: error issues", () => {
      const coursesById = {
        1: { id: 1, course_code: "CS101", course_name: "Intro", student_count: 0 },
      };
      const data = makeData({ coursesById });
      // This triggers INVALID_STUDENT_COUNT (warning) + UNSCHEDULED_EXAM (error)
      const result = validateSchedule(
        data,
        makeAssignmentResult({
          assignments: [
            { course_id: 1, time_slot_id: null, exam_id: 100, primary_instructor_id: null },
          ],
          roomAssignments: [
            { exam_id: 100, room_id: 5, time_slot_id: null, assigned_capacity: 30, supervisor_instructor_id: null },
          ],
        }),
      );

      expect(result.summary.warnings).toBeGreaterThanOrEqual(0);
      expect(result.summary.hardConstraintViolations).toBeGreaterThanOrEqual(1);
      expect(result.summary.totalIssues).toBe(
        result.summary.hardConstraintViolations + result.summary.warnings,
      );
    });
  });
});
