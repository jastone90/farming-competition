import { describe, it, expect } from "vitest";

// computeTotals is inline in the activities page; we replicate it here for testing.
// If it gets extracted to a shared module later, update this import.
interface ActivityData {
  distanceMiles: number | null;
  durationMinutes: number | null;
  elevationGainFeet: number | null;
  caloriesBurned: number | null;
  poundsLifted: number | null;
  modifiedPoints: number;
}

function computeTotals(items: ActivityData[]) {
  let dist = 0, dur = 0, elev = 0, cal = 0, pts = 0, lbs = 0;
  for (const a of items) {
    dist += a.distanceMiles ?? 0;
    dur += a.durationMinutes ?? 0;
    elev += a.elevationGainFeet ?? 0;
    cal += a.caloriesBurned ?? 0;
    lbs += a.poundsLifted ?? 0;
    pts += a.modifiedPoints;
  }
  return { dist, dur, elev, cal, lbs, pts };
}

function makeActivity(overrides: Partial<ActivityData> = {}): ActivityData {
  return {
    distanceMiles: null,
    durationMinutes: null,
    elevationGainFeet: null,
    caloriesBurned: null,
    poundsLifted: null,
    modifiedPoints: 0,
    ...overrides,
  };
}

describe("computeTotals", () => {
  it("returns zeros for an empty array", () => {
    const totals = computeTotals([]);
    expect(totals).toEqual({ dist: 0, dur: 0, elev: 0, cal: 0, lbs: 0, pts: 0 });
  });

  it("sums a single activity", () => {
    const totals = computeTotals([
      makeActivity({
        distanceMiles: 5.2,
        durationMinutes: 42,
        elevationGainFeet: 320,
        caloriesBurned: 400,
        poundsLifted: 0,
        modifiedPoints: 24.96,
      }),
    ]);
    expect(totals.dist).toBeCloseTo(5.2);
    expect(totals.dur).toBe(42);
    expect(totals.elev).toBe(320);
    expect(totals.cal).toBe(400);
    expect(totals.lbs).toBe(0);
    expect(totals.pts).toBeCloseTo(24.96);
  });

  it("sums mixed activity types", () => {
    const totals = computeTotals([
      makeActivity({ distanceMiles: 5, modifiedPoints: 20 }),
      makeActivity({ poundsLifted: 15000, modifiedPoints: 7.5 }),
      makeActivity({ distanceMiles: 0.5, modifiedPoints: 12.5 }),
    ]);
    expect(totals.dist).toBeCloseTo(5.5);
    expect(totals.lbs).toBe(15000);
    expect(totals.pts).toBeCloseTo(40);
  });

  it("treats null fields as zero", () => {
    const totals = computeTotals([
      makeActivity({ modifiedPoints: 10 }),
      makeActivity({ modifiedPoints: 5 }),
    ]);
    expect(totals.dist).toBe(0);
    expect(totals.dur).toBe(0);
    expect(totals.elev).toBe(0);
    expect(totals.cal).toBe(0);
    expect(totals.lbs).toBe(0);
    expect(totals.pts).toBe(15);
  });

  it("tracks poundsLifted separately from calories", () => {
    const totals = computeTotals([
      makeActivity({ poundsLifted: 10000, caloriesBurned: 300, modifiedPoints: 5 }),
      makeActivity({ poundsLifted: 5000, caloriesBurned: 200, modifiedPoints: 2.5 }),
    ]);
    expect(totals.lbs).toBe(15000);
    expect(totals.cal).toBe(500);
  });
});
