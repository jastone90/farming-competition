import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleStravaEvent } from "@/lib/strava/webhook";

// We need to mock the DB and Strava client since the webhook handler
// calls them directly. This tests the control flow, not the DB queries.

vi.mock("@/lib/db", () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    get: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return { db: mockDb };
});

vi.mock("@/lib/strava/token-manager", () => ({
  ensureFreshTokens: vi.fn(),
}));

vi.mock("@/lib/strava/client", () => ({
  getStravaActivity: vi.fn(),
}));

vi.mock("@/lib/strava/mapper", () => ({
  mapStravaActivity: vi.fn(),
}));

vi.mock("@/lib/scoring/active-rules", () => ({
  getActiveRulesForSeason: vi.fn(),
}));

vi.mock("@/lib/scoring/engine", () => ({
  scoreActivity: vi.fn(),
}));

import { db } from "@/lib/db";
import { ensureFreshTokens } from "@/lib/strava/token-manager";
import { getStravaActivity } from "@/lib/strava/client";
import { mapStravaActivity } from "@/lib/strava/mapper";
import { getActiveRulesForSeason } from "@/lib/scoring/active-rules";
import { scoreActivity } from "@/lib/scoring/engine";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleStravaEvent", () => {
  const baseEvent = {
    object_type: "activity",
    object_id: 12345,
    aspect_type: "create",
    owner_id: 99,
  };

  it("ignores non-activity events", async () => {
    await handleStravaEvent({ ...baseEvent, object_type: "athlete" });
    // Should not query DB at all
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns early if user not found", async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    });

    await handleStravaEvent(baseEvent);
    expect(ensureFreshTokens).not.toHaveBeenCalled();
  });

  it("returns early if token refresh fails", async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            id: 1,
            stravaAccessToken: "token",
            stravaRefreshToken: "refresh",
            stravaTokenExpiresAt: 999,
          }),
        }),
      }),
    });
    (ensureFreshTokens as any).mockResolvedValue(null);

    await handleStravaEvent(baseEvent);
    expect(getStravaActivity).not.toHaveBeenCalled();
  });

  it("deletes activity on delete event", async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            id: 1,
            stravaAccessToken: "token",
            stravaRefreshToken: "refresh",
            stravaTokenExpiresAt: 999,
          }),
        }),
      }),
    });
    (ensureFreshTokens as any).mockResolvedValue("fresh_token");

    const mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    (db.delete as any).mockReturnValue(mockDelete());

    await handleStravaEvent({ ...baseEvent, aspect_type: "delete" });

    expect(db.delete).toHaveBeenCalled();
    // Should NOT fetch activity from Strava
    expect(getStravaActivity).not.toHaveBeenCalled();
  });

  it("skips unsupported activity types (mapper returns null)", async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            id: 1,
            stravaAccessToken: "token",
            stravaRefreshToken: "refresh",
            stravaTokenExpiresAt: 999,
          }),
        }),
      }),
    });
    (ensureFreshTokens as any).mockResolvedValue("fresh_token");
    (getStravaActivity as any).mockResolvedValue({ type: "Yoga", id: 12345 });
    (mapStravaActivity as any).mockReturnValue(null);

    await handleStravaEvent(baseEvent);

    expect(getActiveRulesForSeason).not.toHaveBeenCalled();
    expect(scoreActivity).not.toHaveBeenCalled();
  });
});
