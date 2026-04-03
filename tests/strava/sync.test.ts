import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncUserActivities } from "@/lib/strava/sync";

vi.mock("@/lib/db", () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    get: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  };
  return { db: mockDb };
});

vi.mock("@/lib/strava/token-manager", () => ({
  ensureFreshTokens: vi.fn(),
}));

vi.mock("@/lib/strava/client", () => ({
  getStravaActivities: vi.fn(),
}));

vi.mock("@/lib/strava/mapper", () => ({
  mapStravaActivity: vi.fn(),
}));

vi.mock("@/lib/scoring/active-rules", () => ({
  getActiveRulesForSeason: vi.fn(),
}));

vi.mock("@/lib/scoring/engine", () => ({
  scoreActivity: vi.fn(),
  getCurrentEngineVersion: vi.fn(),
}));

import { db } from "@/lib/db";
import { ensureFreshTokens } from "@/lib/strava/token-manager";
import { getStravaActivities } from "@/lib/strava/client";
import { mapStravaActivity } from "@/lib/strava/mapper";
import { getActiveRulesForSeason } from "@/lib/scoring/active-rules";
import { scoreActivity, getCurrentEngineVersion } from "@/lib/scoring/engine";

const mockUser = {
  id: 1,
  name: "Alan",
  stravaAthleteId: "12345",
  stravaAccessToken: "token",
  stravaRefreshToken: "refresh",
  stravaTokenExpiresAt: 9999999999,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncUserActivities", () => {
  it("throws if token refresh fails", async () => {
    (ensureFreshTokens as any).mockResolvedValue(null);

    await expect(syncUserActivities(mockUser)).rejects.toThrow(
      "Strava not connected or token refresh failed"
    );
  });

  it("returns zeros when Strava returns no activities", async () => {
    (ensureFreshTokens as any).mockResolvedValue("fresh_token");
    (getCurrentEngineVersion as any).mockResolvedValue("1.1");
    (getStravaActivities as any).mockResolvedValue([]);

    const result = await syncUserActivities(mockUser);

    expect(result).toEqual({
      imported: 0,
      skipped: 0,
      skippedTypes: {},
      importedTypes: {},
      totalPoints: 0,
    });
  });

  it("imports new activities and tracks points", async () => {
    (ensureFreshTokens as any).mockResolvedValue("fresh_token");
    (getCurrentEngineVersion as any).mockResolvedValue("1.1");

    // First page: 1 activity, second page: empty (stops pagination)
    (getStravaActivities as any)
      .mockResolvedValueOnce([{ id: 100, type: "Run" }])
      .mockResolvedValueOnce([]);

    // No existing activity in DB
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    });

    (mapStravaActivity as any).mockReturnValue({
      stravaActivityId: "100",
      title: "Morning Run",
      type: "run",
      isIndoor: false,
      activityDate: "2026-03-15",
      season: 2026,
      distanceMiles: 5.0,
      durationMinutes: 40,
      elevationGainFeet: 200,
      caloriesBurned: 400,
    });

    (getActiveRulesForSeason as any).mockResolvedValue([
      { ruleType: "base_running", config: { pointsPerMile: 4 } },
    ]);

    (scoreActivity as any).mockReturnValue({
      rawPoints: 20,
      modifiedPoints: 20,
      pointBreakdown: { base: { label: "5 mi × 4 pt/mi", points: 20 } },
    });

    const result = await syncUserActivities(mockUser);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.totalPoints).toBe(20);
    expect(result.importedTypes).toEqual({ run: 1 });
    expect(db.insert).toHaveBeenCalled();
  });

  it("skips activities when mapper returns null", async () => {
    (ensureFreshTokens as any).mockResolvedValue("fresh_token");
    (getCurrentEngineVersion as any).mockResolvedValue("1.1");

    (getStravaActivities as any)
      .mockResolvedValueOnce([{ id: 200, type: "Yoga" }])
      .mockResolvedValueOnce([]);

    // No existing record check
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    });

    (mapStravaActivity as any).mockReturnValue(null);

    const result = await syncUserActivities(mockUser);

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.skippedTypes).toEqual({ Yoga: 1 });
    expect(scoreActivity).not.toHaveBeenCalled();
  });

  it("skips duplicate activities (already in DB)", async () => {
    (ensureFreshTokens as any).mockResolvedValue("fresh_token");
    (getCurrentEngineVersion as any).mockResolvedValue("1.1");

    (getStravaActivities as any)
      .mockResolvedValueOnce([{ id: 300, type: "Run" }])
      .mockResolvedValueOnce([]);

    // Activity already exists
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ id: 1, stravaActivityId: "300" }),
        }),
      }),
    });

    const result = await syncUserActivities(mockUser);

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
    expect(mapStravaActivity).not.toHaveBeenCalled();
  });

  it("respects custom after option", async () => {
    (ensureFreshTokens as any).mockResolvedValue("fresh_token");
    (getCurrentEngineVersion as any).mockResolvedValue("1.1");
    (getStravaActivities as any).mockResolvedValue([]);

    const customAfter = 1700000000;
    await syncUserActivities(mockUser, { after: customAfter });

    expect(getStravaActivities).toHaveBeenCalledWith(
      "fresh_token",
      1,
      30,
      customAfter
    );
  });

  it("paginates through multiple pages", async () => {
    (ensureFreshTokens as any).mockResolvedValue("fresh_token");
    (getCurrentEngineVersion as any).mockResolvedValue("1.1");

    // Two pages of results, then empty
    (getStravaActivities as any)
      .mockResolvedValueOnce([{ id: 400, type: "Run" }])
      .mockResolvedValueOnce([{ id: 401, type: "Ride" }])
      .mockResolvedValueOnce([]);

    // All new activities
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    });

    (mapStravaActivity as any)
      .mockReturnValueOnce({
        stravaActivityId: "400",
        title: "Run",
        type: "run",
        isIndoor: false,
        activityDate: "2026-03-15",
        season: 2026,
        distanceMiles: 3,
        durationMinutes: 25,
        elevationGainFeet: 0,
        caloriesBurned: 300,
      })
      .mockReturnValueOnce({
        stravaActivityId: "401",
        title: "Ride",
        type: "ride",
        isIndoor: false,
        activityDate: "2026-03-16",
        season: 2026,
        distanceMiles: 15,
        durationMinutes: 50,
        elevationGainFeet: 0,
        caloriesBurned: 500,
      });

    (getActiveRulesForSeason as any).mockResolvedValue([]);
    (scoreActivity as any).mockReturnValue({
      rawPoints: 10,
      modifiedPoints: 10,
      pointBreakdown: {},
    });

    const result = await syncUserActivities(mockUser);

    expect(result.imported).toBe(2);
    expect(result.totalPoints).toBe(20);
    expect(result.importedTypes).toEqual({ run: 1, ride: 1 });
    // Verify pagination: page 1, page 2, page 3 (empty)
    expect(getStravaActivities).toHaveBeenCalledTimes(3);
  });

  it("caches rules per season to avoid repeated DB queries", async () => {
    (ensureFreshTokens as any).mockResolvedValue("fresh_token");
    (getCurrentEngineVersion as any).mockResolvedValue("1.1");

    // Two activities in the same season
    (getStravaActivities as any)
      .mockResolvedValueOnce([
        { id: 500, type: "Run" },
        { id: 501, type: "Run" },
      ])
      .mockResolvedValueOnce([]);

    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    });

    const mappedBase = {
      stravaActivityId: "500",
      title: "Run",
      type: "run",
      isIndoor: false,
      activityDate: "2026-03-15",
      season: 2026,
      distanceMiles: 3,
      durationMinutes: 25,
      elevationGainFeet: 0,
      caloriesBurned: 300,
    };

    (mapStravaActivity as any)
      .mockReturnValueOnce({ ...mappedBase, stravaActivityId: "500" })
      .mockReturnValueOnce({ ...mappedBase, stravaActivityId: "501" });

    (getActiveRulesForSeason as any).mockResolvedValue([]);
    (scoreActivity as any).mockReturnValue({
      rawPoints: 10,
      modifiedPoints: 10,
      pointBreakdown: {},
    });

    await syncUserActivities(mockUser);

    // Rules should only be fetched once for season 2026
    expect(getActiveRulesForSeason).toHaveBeenCalledTimes(1);
    expect(getActiveRulesForSeason).toHaveBeenCalledWith(2026);
  });
});
