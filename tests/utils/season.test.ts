import { describe, it, expect } from "vitest";
import { getSeasonForDate } from "@/lib/utils/season";

describe("getSeasonForDate", () => {
  it("returns calendar year for a mid-year date", () => {
    expect(getSeasonForDate("2026-06-15")).toBe(2026);
  });

  it("returns calendar year for January 1 (season start)", () => {
    // Use T00:00:00 to avoid UTC midnight → local time rollback
    expect(getSeasonForDate("2026-01-01T00:00:00")).toBe(2026);
  });

  it("returns calendar year for December 25 (season end)", () => {
    expect(getSeasonForDate("2026-12-25")).toBe(2026);
  });

  it("returns calendar year for December 31 (off-season, still same year)", () => {
    expect(getSeasonForDate("2026-12-31")).toBe(2026);
  });

  it("handles January correctly — no longer subtracts 1", () => {
    expect(getSeasonForDate("2026-01-15")).toBe(2026);
    expect(getSeasonForDate("2025-01-15")).toBe(2025);
  });

  it("accepts a Date object", () => {
    expect(getSeasonForDate(new Date("2024-07-04"))).toBe(2024);
  });

  it("accepts a string date", () => {
    expect(getSeasonForDate("2023-03-10")).toBe(2023);
  });

  it("handles leap year dates", () => {
    expect(getSeasonForDate("2024-02-29")).toBe(2024);
  });

  it("works for historical seasons", () => {
    expect(getSeasonForDate("2022-05-20")).toBe(2022);
  });
});
