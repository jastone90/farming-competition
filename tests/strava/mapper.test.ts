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
    ...overrides,
  };
}

describe("Strava mapper — type mappings", () => {
  it("maps Ride → ride", () => {
    const result = mapStravaActivity(makeStrava({ type: "Ride" }));
    expect(result.type).toBe("ride");
    expect(result.isIndoor).toBe(false);
  });

  it("maps VirtualRide → ride (indoor)", () => {
    const result = mapStravaActivity(makeStrava({ type: "VirtualRide" }));
    expect(result.type).toBe("ride");
    expect(result.isIndoor).toBe(true);
  });

  it("maps Run → run", () => {
    const result = mapStravaActivity(makeStrava({ type: "Run" }));
    expect(result.type).toBe("run");
    expect(result.isIndoor).toBe(false);
  });

  it("maps VirtualRun → run (indoor)", () => {
    const result = mapStravaActivity(makeStrava({ type: "VirtualRun" }));
    expect(result.type).toBe("run");
    expect(result.isIndoor).toBe(true);
  });

  it("maps Walk → walk", () => {
    const result = mapStravaActivity(makeStrava({ type: "Walk" }));
    expect(result.type).toBe("walk");
  });

  it("maps Hike → hiking", () => {
    const result = mapStravaActivity(makeStrava({ type: "Hike" }));
    expect(result.type).toBe("hiking");
  });

  it("maps Rowing → rowing", () => {
    const result = mapStravaActivity(makeStrava({ type: "Rowing" }));
    expect(result.type).toBe("rowing");
  });

  it("maps Swim → swimming", () => {
    const result = mapStravaActivity(makeStrava({ type: "Swim" }));
    expect(result.type).toBe("swimming");
  });

  it("maps WeightTraining → weight_training", () => {
    const result = mapStravaActivity(makeStrava({ type: "WeightTraining" }));
    expect(result.type).toBe("weight_training");
  });

  it("maps Yoga → yoga", () => {
    const result = mapStravaActivity(makeStrava({ type: "Yoga" }));
    expect(result.type).toBe("yoga");
  });

  it("maps unknown type → other", () => {
    const result = mapStravaActivity(makeStrava({ type: "Crossfit" }));
    expect(result.type).toBe("other");
  });
});

describe("Strava mapper — unit conversions", () => {
  it("converts meters to miles", () => {
    const result = mapStravaActivity(makeStrava({ distance: 16093.4 }));
    expect(result.distanceMiles).toBeCloseTo(10, 0);
  });

  it("returns null distance for 0 meters", () => {
    const result = mapStravaActivity(makeStrava({ distance: 0 }));
    expect(result.distanceMiles).toBeNull();
  });

  it("converts elevation meters to feet", () => {
    const result = mapStravaActivity(makeStrava({ total_elevation_gain: 100 }));
    expect(result.elevationGainFeet).toBeCloseTo(328.1, 0);
  });

  it("returns null elevation for 0 meters", () => {
    const result = mapStravaActivity(makeStrava({ total_elevation_gain: 0 }));
    expect(result.elevationGainFeet).toBeNull();
  });

  it("converts seconds to minutes", () => {
    const result = mapStravaActivity(makeStrava({ moving_time: 3600 }));
    expect(result.durationMinutes).toBe(60);
  });
});

describe("Strava mapper — indoor detection", () => {
  it("VirtualRide is indoor", () => {
    const result = mapStravaActivity(makeStrava({ type: "VirtualRide" }));
    expect(result.isIndoor).toBe(true);
  });

  it("trainer flag makes it indoor", () => {
    const result = mapStravaActivity(makeStrava({ type: "Ride", trainer: true }));
    expect(result.isIndoor).toBe(true);
  });

  it("regular ride is outdoor", () => {
    const result = mapStravaActivity(makeStrava({ type: "Ride", trainer: false }));
    expect(result.isIndoor).toBe(false);
  });
});

describe("Strava mapper — season calculation", () => {
  it("January activity belongs to previous year season", () => {
    const result = mapStravaActivity(makeStrava({ start_date: "2026-01-15T10:00:00Z" }));
    expect(result.season).toBe(2025);
  });

  it("February activity belongs to current year season", () => {
    const result = mapStravaActivity(makeStrava({ start_date: "2026-02-01T10:00:00Z" }));
    expect(result.season).toBe(2026);
  });

  it("December activity belongs to current year season", () => {
    const result = mapStravaActivity(makeStrava({ start_date: "2026-12-31T10:00:00Z" }));
    expect(result.season).toBe(2026);
  });
});

describe("Strava mapper — other fields", () => {
  it("sets stravaActivityId as string", () => {
    const result = mapStravaActivity(makeStrava({ id: 99999 }));
    expect(result.stravaActivityId).toBe("99999");
  });

  it("passes through calories or null", () => {
    const withCal = mapStravaActivity(makeStrava({ calories: 350 }));
    expect(withCal.caloriesBurned).toBe(350);

    const noCal = mapStravaActivity(makeStrava({ calories: 0 }));
    expect(noCal.caloriesBurned).toBeNull();
  });

  it("extracts activityDate as YYYY-MM-DD", () => {
    const result = mapStravaActivity(makeStrava({ start_date: "2026-03-15T10:30:00Z" }));
    expect(result.activityDate).toBe("2026-03-15");
  });
});
