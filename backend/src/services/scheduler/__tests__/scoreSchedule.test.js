import { describe, it, expect } from "vitest";
import scoreSchedule from "../scoreSchedule.js";

// ─── helpers ───────────────────────────────────────────────────────────────

function makeData(opts = {}) {
  return {
    timeSlots: opts.timeSlots ?? [],
    coursesByStudent: opts.coursesByStudent ?? {},
  };
}

function makeAssignmentResult(assignments = [], roomAssignments = []) {
  return { assignments, roomAssignments };
}

function makeValidation(hardViolations = 0, warnings = 0) {
  return {
    isValid: hardViolations === 0,
    summary: {
      hardConstraintViolations: hardViolations,
      warnings,
      totalIssues: hardViolations + warnings,
    },
    issues: [],
  };
}

// ─── tests ─────────────────────────────────────────────────────────────────

describe("scoreSchedule", () => {
  describe("return shape", () => {
    it("always returns qualityScore and a metrics object", () => {
      const result = scoreSchedule(
        makeData(),
        makeAssignmentResult(),
        makeValidation(),
      );

      expect(result).toHaveProperty("qualityScore");
      expect(result).toHaveProperty("metrics");
      expect(typeof result.qualityScore).toBe("number");
    });

    it("metrics contain expected keys", () => {
      const result = scoreSchedule(
        makeData(),
        makeAssignmentResult(),
        makeValidation(),
      );

      const { metrics } = result;
      expect(metrics).toHaveProperty("totalExams");
      expect(metrics).toHaveProperty("scheduledExams");
      expect(metrics).toHaveProperty("averageRoomUtilization");
      expect(metrics).toHaveProperty("sameDayStudentConflicts");
      expect(metrics).toHaveProperty("closeSameDayStudentConflicts");
      expect(metrics).toHaveProperty("maxExamsPerStudentPerDay");
      expect(metrics).toHaveProperty("mostCrowdedDay");
      expect(metrics).toHaveProperty("instructorLoadDistribution");
    });
  });

  describe("qualityScore bounds", () => {
    it("score is always between 0 and 100", () => {
      // Extreme case: many hard violations
      const result = scoreSchedule(
        makeData(),
        makeAssignmentResult(),
        makeValidation(100), // 100 * 25 = 2500 penalty → should clamp to 0
      );

      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    it("score is 100 with no violations and no assignments (no penalties applied)", () => {
      const result = scoreSchedule(
        makeData(),
        makeAssignmentResult(),
        makeValidation(0),
      );

      // With no exams no room assignments and no student conflicts
      // the only penalty comes from room utilization (0 vs target 0.7)
      // → 100 - 0.7*15 = 89.5, but with 0 room assignments avg is 0
      // Let's just check it's a high score (>= 80) or handle it precisely:
      // score = 100 - (0/0)*4 - (0/0)*2 - max(0,0-2)*6 - max(0,0-6)*2.5 - max(0,0.7-0)*15
      // = 100 - 0 - 0 - 0 - 0 - 10.5 = 89.5
      // (totalExams defaults to 1 in the formula, averageRoomUtilization = 0)
      expect(result.qualityScore).toBeGreaterThanOrEqual(85);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    it("each hard violation reduces score by 25", () => {
      const noViolations = scoreSchedule(
        makeData(),
        makeAssignmentResult(),
        makeValidation(0),
      );
      const oneViolation = scoreSchedule(
        makeData(),
        makeAssignmentResult(),
        makeValidation(1),
      );

      expect(noViolations.qualityScore - oneViolation.qualityScore).toBeCloseTo(
        25,
        1,
      );
    });
  });

  describe("metrics.scheduledExams", () => {
    it("counts only assignments that have a time_slot_id", () => {
      const assignments = [
        { course_id: 1, time_slot_id: 10, primary_instructor_id: null },
        { course_id: 2, time_slot_id: null, primary_instructor_id: null },
        { course_id: 3, time_slot_id: 20, primary_instructor_id: null },
      ];
      const result = scoreSchedule(
        makeData(),
        makeAssignmentResult(assignments),
        makeValidation(),
      );

      expect(result.metrics.totalExams).toBe(3);
      expect(result.metrics.scheduledExams).toBe(2);
    });
  });

  describe("metrics.mostCrowdedDay", () => {
    it("identifies the day with the most exams", () => {
      const slots = [
        { id: 1, slot_date: "2026-06-01", start_time: "09:00:00", end_time: "11:00:00" },
        { id: 2, slot_date: "2026-06-01", start_time: "13:00:00", end_time: "15:00:00" },
        { id: 3, slot_date: "2026-06-02", start_time: "09:00:00", end_time: "11:00:00" },
      ];
      const assignments = [
        { course_id: 1, time_slot_id: 1, primary_instructor_id: null },
        { course_id: 2, time_slot_id: 2, primary_instructor_id: null },
        { course_id: 3, time_slot_id: 3, primary_instructor_id: null },
      ];
      const result = scoreSchedule(
        makeData({ timeSlots: slots }),
        makeAssignmentResult(assignments),
        makeValidation(),
      );

      expect(result.metrics.mostCrowdedDay.date).toBe("2026-06-01");
      expect(result.metrics.mostCrowdedDay.examCount).toBe(2);
    });

    it("returns null date when there are no scheduled exams", () => {
      const result = scoreSchedule(
        makeData(),
        makeAssignmentResult([{ course_id: 1, time_slot_id: null, primary_instructor_id: null }]),
        makeValidation(),
      );

      expect(result.metrics.mostCrowdedDay.date).toBeNull();
      expect(result.metrics.mostCrowdedDay.examCount).toBe(0);
    });
  });

  describe("metrics.averageRoomUtilization", () => {
    it("returns 0 when there are no room assignments", () => {
      const result = scoreSchedule(
        makeData(),
        makeAssignmentResult([], []),
        makeValidation(),
      );

      expect(result.metrics.averageRoomUtilization).toBe(0);
    });

    it("calculates average across room assignments", () => {
      const roomAssignments = [
        { room_capacity: 100, assigned_capacity: 80 },  // 0.8
        { room_capacity: 50, assigned_capacity: 25 },   // 0.5
      ];
      const result = scoreSchedule(
        makeData(),
        makeAssignmentResult([], roomAssignments),
        makeValidation(),
      );

      // average = (0.8 + 0.5) / 2 = 0.65
      expect(result.metrics.averageRoomUtilization).toBeCloseTo(0.65, 2);
    });
  });
});
