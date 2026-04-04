import { describe, it, expect } from "vitest";
import { formatMonth, formatDate, MONTH_NAMES } from "@/lib/utils";

describe("formatMonth", () => {
  it("formats a standard month", () => {
    expect(formatMonth("2026-06")).toBe("Jun 2026");
  });

  it("formats January (edge month)", () => {
    expect(formatMonth("2026-01")).toBe("Jan 2026");
  });

  it("formats December (edge month)", () => {
    expect(formatMonth("2026-12")).toBe("Dec 2026");
  });

  it("formats with leading zeros", () => {
    expect(formatMonth("2022-03")).toBe("Mar 2022");
  });

  it("handles historical years", () => {
    expect(formatMonth("2022-07")).toBe("Jul 2022");
  });
});

describe("formatDate", () => {
  it("formats a standard date", () => {
    expect(formatDate("2026-03-15")).toBe("Mar 15, 2026");
  });

  it("formats January 1", () => {
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
  });

  it("formats December 31", () => {
    expect(formatDate("2026-12-31")).toBe("Dec 31, 2026");
  });

  it("strips leading zeros from day", () => {
    expect(formatDate("2026-04-05")).toBe("Apr 5, 2026");
  });

  it("handles leap day", () => {
    expect(formatDate("2024-02-29")).toBe("Feb 29, 2024");
  });
});

describe("MONTH_NAMES", () => {
  it("has 12 entries", () => {
    expect(MONTH_NAMES).toHaveLength(12);
  });

  it("starts with Jan and ends with Dec", () => {
    expect(MONTH_NAMES[0]).toBe("Jan");
    expect(MONTH_NAMES[11]).toBe("Dec");
  });
});
