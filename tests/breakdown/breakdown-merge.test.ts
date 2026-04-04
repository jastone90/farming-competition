import { describe, it, expect } from "vitest";

/**
 * Tests the merge logic used on the dashboard to combine weight_training
 * indoor/outdoor rows while keeping other types split by indoor/outdoor.
 * Mirrors the IIFE in app/page.tsx's farming breakdown section.
 */

interface TypeBreakdown {
  type: string;
  isIndoor: boolean;
  count: number;
  totalPoints: number;
  totalMiles: number | null;
  totalElevation: number | null;
  totalDuration: number | null;
  totalPoundsLifted: number | null;
}

function mergeBreakdown(breakdown: TypeBreakdown[]): TypeBreakdown[] {
  const merged: TypeBreakdown[] = [];
  const wtAcc: TypeBreakdown = {
    type: "weight_training",
    isIndoor: true,
    count: 0,
    totalPoints: 0,
    totalMiles: null,
    totalElevation: null,
    totalDuration: null,
    totalPoundsLifted: 0,
  };
  let hasWt = false;
  for (const b of breakdown) {
    if (b.type === "weight_training") {
      hasWt = true;
      wtAcc.count += b.count;
      wtAcc.totalPoints += b.totalPoints;
      wtAcc.totalPoundsLifted = (wtAcc.totalPoundsLifted ?? 0) + (b.totalPoundsLifted ?? 0);
      wtAcc.totalDuration = (wtAcc.totalDuration ?? 0) + (b.totalDuration ?? 0);
    } else {
      merged.push(b);
    }
  }
  if (hasWt) merged.push(wtAcc);
  merged.sort((a, b) => b.totalPoints - a.totalPoints);
  return merged;
}

describe("breakdown merge logic", () => {
  it("merges weight_training indoor + outdoor into one row", () => {
    const input: TypeBreakdown[] = [
      { type: "weight_training", isIndoor: true, count: 5, totalPoints: 10, totalMiles: null, totalElevation: null, totalDuration: 300, totalPoundsLifted: 50000 },
      { type: "weight_training", isIndoor: false, count: 2, totalPoints: 4, totalMiles: null, totalElevation: null, totalDuration: 120, totalPoundsLifted: 20000 },
    ];

    const result = mergeBreakdown(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("weight_training");
    expect(result[0].count).toBe(7);
    expect(result[0].totalPoints).toBe(14);
    expect(result[0].totalPoundsLifted).toBe(70000);
    expect(result[0].totalDuration).toBe(420);
  });

  it("keeps ride indoor and outdoor as separate rows", () => {
    const input: TypeBreakdown[] = [
      { type: "ride", isIndoor: false, count: 10, totalPoints: 100, totalMiles: 200, totalElevation: 5000, totalDuration: 600, totalPoundsLifted: null },
      { type: "ride", isIndoor: true, count: 5, totalPoints: 40, totalMiles: 80, totalElevation: null, totalDuration: 225, totalPoundsLifted: null },
    ];

    const result = mergeBreakdown(input);
    expect(result).toHaveLength(2);
    expect(result[0].isIndoor).toBe(false); // higher points first
    expect(result[1].isIndoor).toBe(true);
  });

  it("keeps run indoor and outdoor as separate rows", () => {
    const input: TypeBreakdown[] = [
      { type: "run", isIndoor: false, count: 8, totalPoints: 80, totalMiles: 40, totalElevation: 3000, totalDuration: 400, totalPoundsLifted: null },
      { type: "run", isIndoor: true, count: 3, totalPoints: 24, totalMiles: 12, totalElevation: null, totalDuration: 120, totalPoundsLifted: null },
    ];

    const result = mergeBreakdown(input);
    expect(result).toHaveLength(2);
    const outdoor = result.find((r) => !r.isIndoor)!;
    const indoor = result.find((r) => r.isIndoor)!;
    expect(outdoor.totalPoints).toBe(80);
    expect(indoor.totalPoints).toBe(24);
  });

  it("sorts merged result by totalPoints descending", () => {
    const input: TypeBreakdown[] = [
      { type: "run", isIndoor: false, count: 1, totalPoints: 20, totalMiles: 5, totalElevation: null, totalDuration: 30, totalPoundsLifted: null },
      { type: "weight_training", isIndoor: true, count: 10, totalPoints: 50, totalMiles: null, totalElevation: null, totalDuration: 600, totalPoundsLifted: 100000 },
      { type: "ride", isIndoor: false, count: 3, totalPoints: 35, totalMiles: 35, totalElevation: null, totalDuration: 120, totalPoundsLifted: null },
    ];

    const result = mergeBreakdown(input);
    expect(result.map((r) => r.type)).toEqual(["weight_training", "ride", "run"]);
  });

  it("handles mixed types with indoor splits and merged weight_training", () => {
    const input: TypeBreakdown[] = [
      { type: "run", isIndoor: false, count: 5, totalPoints: 60, totalMiles: 30, totalElevation: 2000, totalDuration: 250, totalPoundsLifted: null },
      { type: "run", isIndoor: true, count: 2, totalPoints: 16, totalMiles: 8, totalElevation: null, totalDuration: 80, totalPoundsLifted: null },
      { type: "ride", isIndoor: false, count: 3, totalPoints: 30, totalMiles: 30, totalElevation: 500, totalDuration: 90, totalPoundsLifted: null },
      { type: "ride", isIndoor: true, count: 1, totalPoints: 10, totalMiles: 10, totalElevation: null, totalDuration: 30, totalPoundsLifted: null },
      { type: "weight_training", isIndoor: true, count: 8, totalPoints: 20, totalMiles: null, totalElevation: null, totalDuration: 480, totalPoundsLifted: 80000 },
      { type: "swimming", isIndoor: true, count: 2, totalPoints: 25, totalMiles: 1, totalElevation: null, totalDuration: 60, totalPoundsLifted: null },
    ];

    const result = mergeBreakdown(input);
    // 5 rows: run outdoor, run indoor, ride outdoor, ride indoor, weight_training merged, swimming indoor
    expect(result).toHaveLength(6);
    // weight_training should be single row
    const wt = result.filter((r) => r.type === "weight_training");
    expect(wt).toHaveLength(1);
    expect(wt[0].count).toBe(8);
    // sorted by points: run outdoor (60), ride outdoor (30), swimming (25), wt (20), run indoor (16), ride indoor (10)
    expect(result[0].totalPoints).toBe(60);
    expect(result[5].totalPoints).toBe(10);
  });

  it("returns empty array for empty input", () => {
    expect(mergeBreakdown([])).toEqual([]);
  });

  it("handles single weight_training row", () => {
    const input: TypeBreakdown[] = [
      { type: "weight_training", isIndoor: true, count: 3, totalPoints: 7.5, totalMiles: null, totalElevation: null, totalDuration: 180, totalPoundsLifted: 15000 },
    ];

    const result = mergeBreakdown(input);
    expect(result).toHaveLength(1);
    expect(result[0].totalPoundsLifted).toBe(15000);
  });

  it("handles only outdoor activities (no indoor split needed)", () => {
    const input: TypeBreakdown[] = [
      { type: "run", isIndoor: false, count: 10, totalPoints: 100, totalMiles: 50, totalElevation: 5000, totalDuration: 500, totalPoundsLifted: null },
      { type: "ride", isIndoor: false, count: 5, totalPoints: 50, totalMiles: 50, totalElevation: 1000, totalDuration: 200, totalPoundsLifted: null },
    ];

    const result = mergeBreakdown(input);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("run");
    expect(result[1].type).toBe("ride");
  });

  it("handles null totalPoundsLifted in weight_training merge", () => {
    const input: TypeBreakdown[] = [
      { type: "weight_training", isIndoor: true, count: 2, totalPoints: 5, totalMiles: null, totalElevation: null, totalDuration: 120, totalPoundsLifted: null },
      { type: "weight_training", isIndoor: false, count: 1, totalPoints: 3, totalMiles: null, totalElevation: null, totalDuration: 60, totalPoundsLifted: 10000 },
    ];

    const result = mergeBreakdown(input);
    expect(result).toHaveLength(1);
    expect(result[0].totalPoundsLifted).toBe(10000);
    expect(result[0].totalPoints).toBe(8);
  });
});
