import { describe, it, expect } from "vitest";
import { ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS } from "@/lib/constants";
import type { ActivityType } from "@/lib/scoring/types";

const ALL_ACTIVITY_TYPES: ActivityType[] = [
  "ride",
  "run",
  "weight_training",
  "swimming",
];

describe("ACTIVITY_TYPE_LABELS", () => {
  it("has a label for every ActivityType", () => {
    for (const type of ALL_ACTIVITY_TYPES) {
      expect(ACTIVITY_TYPE_LABELS[type]).toBeDefined();
      expect(typeof ACTIVITY_TYPE_LABELS[type]).toBe("string");
      expect(ACTIVITY_TYPE_LABELS[type].length).toBeGreaterThan(0);
    }
  });

  it("has no extra keys beyond ActivityType values", () => {
    const keys = Object.keys(ACTIVITY_TYPE_LABELS);
    expect(keys.sort()).toEqual([...ALL_ACTIVITY_TYPES].sort());
  });

  it("uses 'Haybailz' for weight_training", () => {
    expect(ACTIVITY_TYPE_LABELS.weight_training).toBe("Haybailz");
  });
});

describe("ACTIVITY_TYPE_COLORS", () => {
  it("has a color for every ActivityType", () => {
    for (const type of ALL_ACTIVITY_TYPES) {
      expect(ACTIVITY_TYPE_COLORS[type]).toBeDefined();
      expect(ACTIVITY_TYPE_COLORS[type]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("has no extra keys beyond ActivityType values", () => {
    const keys = Object.keys(ACTIVITY_TYPE_COLORS);
    expect(keys.sort()).toEqual([...ALL_ACTIVITY_TYPES].sort());
  });
});
