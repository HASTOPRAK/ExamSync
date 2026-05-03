import { describe, it, expect } from "vitest";
import { formatDate, formatTime } from "../formatDate.js";

describe("formatDate", () => {
  it("returns '-' for null input", () => {
    expect(formatDate(null)).toBe("-");
  });

  it("returns '-' for undefined input", () => {
    expect(formatDate(undefined)).toBe("-");
  });

  it("returns '-' for empty string", () => {
    expect(formatDate("")).toBe("-");
  });

  it("returns the original value for an unparseable string", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("formats a valid ISO date string into a human-readable date", () => {
    const result = formatDate("2026-06-15");
    // en-GB format: "15 Jun 2026"
    expect(result).toMatch(/15/);
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2026/);
  });

  it("formats a full ISO datetime string (strips time part visually)", () => {
    const result = formatDate("2026-06-15T09:00:00.000Z");
    expect(result).toMatch(/2026/);
    expect(typeof result).toBe("string");
    expect(result).not.toBe("-");
  });
});

describe("formatTime", () => {
  it("returns '-' for null input", () => {
    expect(formatTime(null)).toBe("-");
  });

  it("returns '-' for undefined input", () => {
    expect(formatTime(undefined)).toBe("-");
  });

  it("returns '-' for empty string", () => {
    expect(formatTime("")).toBe("-");
  });

  it("slices a HH:MM:SS string to HH:MM", () => {
    expect(formatTime("09:30:00")).toBe("09:30");
  });

  it("returns the first 5 characters of any string", () => {
    expect(formatTime("14:00:00")).toBe("14:00");
  });

  it("handles short strings without throwing", () => {
    const result = formatTime("09");
    expect(typeof result).toBe("string");
  });
});
