import { describe, it, expect } from "vitest";
import buildConflictGraph from "../buildConflictGraph.js";

// Helper to build minimal course objects
function makeCourse(id, opts = {}) {
  return {
    id,
    course_code: `C${id}`,
    course_name: `Course ${id}`,
    student_count_cache: opts.studentCount ?? 0,
    ...opts,
  };
}

describe("buildConflictGraph", () => {
  describe("empty / trivial inputs", () => {
    it("returns empty structures when there are no courses", () => {
      const result = buildConflictGraph({ courses: [], coursesByStudent: {} });

      expect(result.conflictPairs).toEqual([]);
      expect(result.courseOrder).toEqual([]);
      expect(result.summary).toEqual({
        totalCourses: 0,
        totalConflictPairs: 0,
        coursesWithConflicts: 0,
        coursesWithoutConflicts: 0,
        maxConflictWeight: 0,
      });
    });

    it("returns no conflict pairs for a single course with no students", () => {
      const result = buildConflictGraph({
        courses: [makeCourse(1)],
        coursesByStudent: {},
      });

      expect(result.conflictPairs).toHaveLength(0);
      expect(result.summary.coursesWithConflicts).toBe(0);
      expect(result.summary.coursesWithoutConflicts).toBe(1);
    });

    it("returns no conflict pairs when a student is enrolled in only one course", () => {
      const result = buildConflictGraph({
        courses: [makeCourse(1), makeCourse(2)],
        coursesByStudent: {
          101: [1], // student 101 is only in course 1
        },
      });

      expect(result.conflictPairs).toHaveLength(0);
    });
  });

  describe("conflict detection", () => {
    it("creates one conflict pair when one student shares two courses", () => {
      const result = buildConflictGraph({
        courses: [makeCourse(1), makeCourse(2)],
        coursesByStudent: {
          101: [1, 2],
        },
      });

      expect(result.conflictPairs).toHaveLength(1);
      expect(result.conflictPairs[0]).toMatchObject({
        course_id_1: 1,
        course_id_2: 2,
        shared_students: 1,
      });
    });

    it("accumulates weight when multiple students share the same two courses", () => {
      const result = buildConflictGraph({
        courses: [makeCourse(1), makeCourse(2)],
        coursesByStudent: {
          101: [1, 2],
          102: [1, 2],
        },
      });

      expect(result.conflictPairs).toHaveLength(1);
      expect(result.conflictPairs[0].shared_students).toBe(2);
    });

    it("creates separate pairs for non-overlapping student groups", () => {
      // student 101 → courses 1,2   creates pair 1-2
      // student 102 → courses 2,3   creates pair 2-3
      const result = buildConflictGraph({
        courses: [makeCourse(1), makeCourse(2), makeCourse(3)],
        coursesByStudent: {
          101: [1, 2],
          102: [2, 3],
        },
      });

      expect(result.conflictPairs).toHaveLength(2);
      const keys = result.conflictPairs.map(
        (p) => `${p.course_id_1}-${p.course_id_2}`,
      );
      expect(keys).toContain("1-2");
      expect(keys).toContain("2-3");
    });

    it("does not create duplicate pairs (A-B and B-A are the same)", () => {
      const result = buildConflictGraph({
        courses: [makeCourse(1), makeCourse(2)],
        coursesByStudent: {
          101: [1, 2],
          102: [2, 1], // same pair, reversed order
        },
      });

      expect(result.conflictPairs).toHaveLength(1);
      expect(result.conflictPairs[0].shared_students).toBe(2);
    });

    it("pair keys are always ordered with the smaller id first", () => {
      const result = buildConflictGraph({
        courses: [makeCourse(5), makeCourse(2)],
        coursesByStudent: {
          101: [5, 2],
        },
      });

      expect(result.conflictPairs[0].course_id_1).toBe(2);
      expect(result.conflictPairs[0].course_id_2).toBe(5);
    });
  });

  describe("courseMetrics", () => {
    it("counts conflict_count as number of distinct conflicting neighbors", () => {
      // course 1 conflicts with 2 and 3
      const result = buildConflictGraph({
        courses: [makeCourse(1), makeCourse(2), makeCourse(3)],
        coursesByStudent: {
          101: [1, 2],
          102: [1, 3],
        },
      });

      expect(result.courseMetrics[1].conflict_count).toBe(2);
      expect(result.courseMetrics[2].conflict_count).toBe(1);
      expect(result.courseMetrics[3].conflict_count).toBe(1);
    });

    it("calculates total_conflict_weight as sum of shared students across all neighbors", () => {
      const result = buildConflictGraph({
        courses: [makeCourse(1), makeCourse(2), makeCourse(3)],
        coursesByStudent: {
          101: [1, 2],
          102: [1, 2],
          103: [1, 3],
        },
      });

      // course 1: weight with 2 is 2, weight with 3 is 1 → total 3
      expect(result.courseMetrics[1].total_conflict_weight).toBe(3);
    });
  });

  describe("courseOrder sorting", () => {
    it("places courses with higher conflict_count first", () => {
      // course 1 conflicts with 2 and 3 (conflict_count 2)
      // course 2 and 3 conflict only with 1 (conflict_count 1 each)
      const result = buildConflictGraph({
        courses: [makeCourse(2), makeCourse(1), makeCourse(3)],
        coursesByStudent: {
          101: [1, 2],
          102: [1, 3],
        },
      });

      expect(result.courseOrder[0].id).toBe(1);
    });

    it("breaks ties by total_conflict_weight", () => {
      // courses 1 and 2 both have conflict_count 1 with course 3
      // but course 1 shares 3 students with 3, course 2 shares 1
      const result = buildConflictGraph({
        courses: [makeCourse(1), makeCourse(2), makeCourse(3)],
        coursesByStudent: {
          101: [1, 3],
          102: [1, 3],
          103: [1, 3],
          104: [2, 3],
        },
      });

      // course 1 and 3 share 3 students; course 2 and 3 share 1
      // course 1: conflict_count 1, weight 3
      // course 3: conflict_count 2, weight 4 → comes first
      expect(result.courseOrder[0].id).toBe(3);
    });
  });

  describe("summary", () => {
    it("reports maxConflictWeight as the heaviest pair's shared_students", () => {
      const result = buildConflictGraph({
        courses: [makeCourse(1), makeCourse(2), makeCourse(3)],
        coursesByStudent: {
          101: [1, 2],
          102: [1, 2],
          103: [1, 2],
          104: [2, 3],
        },
      });

      expect(result.summary.maxConflictWeight).toBe(3);
    });

    it("reports maxConflictWeight as 0 when there are no conflict pairs", () => {
      const result = buildConflictGraph({
        courses: [makeCourse(1), makeCourse(2)],
        coursesByStudent: {},
      });

      expect(result.summary.maxConflictWeight).toBe(0);
    });

    it("counts coursesWithConflicts and coursesWithoutConflicts correctly", () => {
      const result = buildConflictGraph({
        courses: [makeCourse(1), makeCourse(2), makeCourse(3)],
        coursesByStudent: {
          101: [1, 2],
        },
      });

      expect(result.summary.coursesWithConflicts).toBe(2); // 1 and 2
      expect(result.summary.coursesWithoutConflicts).toBe(1); // 3
    });
  });
});
