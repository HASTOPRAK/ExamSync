import { describe, it, expect } from "vitest";
import parseCsvBuffer from "../parseCsvBuffer.js";

function toBuffer(str) {
  return Buffer.from(str, "utf-8");
}

describe("parseCsvBuffer", () => {
  it("parses a simple CSV into an array of objects", () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const result = parseCsvBuffer(toBuffer(csv));

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "Alice", age: "30" });
    expect(result[1]).toEqual({ name: "Bob", age: "25" });
  });

  it("returns an empty array for a header-only CSV", () => {
    const csv = "name,age\n";
    const result = parseCsvBuffer(toBuffer(csv));

    expect(result).toHaveLength(0);
  });

  it("trims whitespace from values", () => {
    const csv = "name,code\n  Alice  ,  CSE101  ";
    const result = parseCsvBuffer(toBuffer(csv));

    expect(result[0].name).toBe("Alice");
    expect(result[0].code).toBe("CSE101");
  });

  it("trims whitespace from header keys", () => {
    const csv = " name , code \nAlice,CSE101";
    const result = parseCsvBuffer(toBuffer(csv));

    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("code");
  });

  it("strips UTF-8 BOM from the start of the file", () => {
    const bom = "\uFEFF";
    const csv = `${bom}name,age\nAlice,30`;
    const result = parseCsvBuffer(toBuffer(csv));

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("name", "Alice");
  });

  it("normalizes missing values to empty string", () => {
    const csv = "name,code\nAlice,";
    const result = parseCsvBuffer(toBuffer(csv));

    expect(result[0].code).toBe("");
  });

  it("skips empty lines in the middle of the file", () => {
    const csv = "name,age\nAlice,30\n\nBob,25";
    const result = parseCsvBuffer(toBuffer(csv));

    expect(result).toHaveLength(2);
  });

  it("handles CRLF line endings", () => {
    const csv = "name,age\r\nAlice,30\r\nBob,25";
    const result = parseCsvBuffer(toBuffer(csv));

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Alice");
  });

  it("returns objects with all header columns as keys", () => {
    const csv = "student_no,course_code\n20210001,CSE101";
    const result = parseCsvBuffer(toBuffer(csv));

    expect(Object.keys(result[0])).toEqual(["student_no", "course_code"]);
  });
});
