import { describe, it, expect } from "vitest";
import { mapStravaActivity } from "@/lib/strava/mapper";

function makeStrava(overrides: Record<string, unknown> = {}) {
  return {
    id: 1234,
    name: "Test Activity",
    type: "Ride",
    distance: 16093.4, // ~10 miles
    moving_time: 3600, // 60 minutes
    total_elevation_gain: 100, // 100 meters
    calories: 500,
    start_date: "2026-03-15T10:00:00Z",
    start_date_local: "2026-03-15T10:00:00Z",
    ...overrides,
  };
}

describe("Strava mapper — type mappings", () => {
  it("maps Ride → ride", () => {
    const result = mapStravaActivity(makeStrava({ type: "Ride" }));
    expect(result!.type).toBe("ride");
    expect(result!.isIndoor).toBe(false);
  });

  it("maps VirtualRide → ride (indoor)", () => {
    const result = mapStravaActivity(makeStrava({ type: "VirtualRide" }));
    expect(result!.type).toBe("ride");
    expect(result!.isIndoor).toBe(true);
  });

  it("maps Run → run", () => {
    const result = mapStravaActivity(makeStrava({ type: "Run" }));
    expect(result!.type).toBe("run");
    expect(result!.isIndoor).toBe(false);
  });

  it("maps VirtualRun → run (indoor)", () => {
    const result = mapStravaActivity(makeStrava({ type: "VirtualRun" }));
    expect(result!.type).toBe("run");
    expect(result!.isIndoor).toBe(true);
  });

  it("maps Swim → swimming", () => {
    const result = mapStravaActivity(makeStrava({ type: "Swim" }));
    expect(result!.type).toBe("swimming");
  });

  it("maps WeightTraining → weight_training", () => {
    const result = mapStravaActivity(makeStrava({ type: "WeightTraining" }));
    expect(result!.type).toBe("weight_training");
  });

  // Unsupported types return null (skipped during import)
  it("returns null for Walk (unsupported)", () => {
    expect(mapStravaActivity(makeStrava({ type: "Walk" }))).toBeNull();
  });

  it("returns null for Hike (unsupported)", () => {
    expect(mapStravaActivity(makeStrava({ type: "Hike" }))).toBeNull();
  });

  it("returns null for Rowing (unsupported)", () => {
    expect(mapStravaActivity(makeStrava({ type: "Rowing" }))).toBeNull();
  });

  it("returns null for Yoga (unsupported)", () => {
    expect(mapStravaActivity(makeStrava({ type: "Yoga" }))).toBeNull();
  });

  it("returns null for unknown type (Crossfit)", () => {
    expect(mapStravaActivity(makeStrava({ type: "Crossfit" }))).toBeNull();
  });
});

describe("Strava mapper — unit conversions", () => {
  it("converts meters to miles", () => {
    const result = mapStravaActivity(makeStrava({ distance: 16093.4 }));
    expect(result!.distanceMiles).toBeCloseTo(10, 0);
  });

  it("returns null distance for 0 meters", () => {
    const result = mapStravaActivity(makeStrava({ distance: 0 }));
    expect(result!.distanceMiles).toBeNull();
  });

  it("converts elevation meters to feet", () => {
    const result = mapStravaActivity(makeStrava({ total_elevation_gain: 100 }));
    expect(result!.elevationGainFeet).toBeCloseTo(328.1, 0);
  });

  it("returns null elevation for 0 gain", () => {
    const result = mapStravaActivity(makeStrava({ total_elevation_gain: 0 }));
    expect(result!.elevationGainFeet).toBeNull();
  });

  it("converts moving_time seconds to minutes", () => {
    const result = mapStravaActivity(makeStrava({ moving_time: 5400 }));
    expect(result!.durationMinutes).toBe(90);
  });

  it("passes calories through", () => {
    const result = mapStravaActivity(makeStrava({ calories: 750 }));
    expect(result!.caloriesBurned).toBe(750);
  });

  it("returns null calories when missing", () => {
    const result = mapStravaActivity(makeStrava({ calories: undefined }));
    expect(result!.caloriesBurned).toBeNull();
  });

  it("marks trainer activities as indoor", () => {
    const result = mapStravaActivity(makeStrava({ type: "Ride", trainer: true }));
    expect(result!.isIndoor).toBe(true);
  });
});

describe("Strava mapper — season calculation", () => {
  it("January activity belongs to current year (season = calendar year)", () => {
    const result = mapStravaActivity(makeStrava({ start_date_local: "2026-01-15T10:00:00Z" }));
    expect(result!.season).toBe(2026);
  });

  it("February activity belongs to current year season", () => {
    const result = mapStravaActivity(makeStrava({ start_date_local: "2026-02-01T10:00:00Z" }));
    expect(result!.season).toBe(2026);
  });

  it("December activity belongs to current year season", () => {
    const result = mapStravaActivity(makeStrava({ start_date_local: "2026-12-31T10:00:00Z" }));
    expect(result!.season).toBe(2026);
  });
});
