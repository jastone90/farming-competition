import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies before importing the route
vi.mock("@/lib/db", () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    all: vi.fn(),
    get: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  };
  return { db: mockDb };
});

vi.mock("@/lib/strava/sync", () => ({
  syncUserActivities: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

import { db } from "@/lib/db";
import { syncUserActivities } from "@/lib/strava/sync";
import { logAudit } from "@/lib/audit";
import { GET } from "@/app/api/strava/sync-all/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRAVA_SYNC_SECRET", "test-secret");
});

function makeRequest(authHeader?: string) {
  const headers = new Headers();
  if (authHeader) headers.set("Authorization", authHeader);
  return new Request("http://localhost:3000/api/strava/sync-all", { headers });
}

describe("GET /api/strava/sync-all", () => {
  it("returns 401 without auth header", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 with wrong secret", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 401 with missing STRAVA_SYNC_SECRET env var", async () => {
    vi.stubEnv("STRAVA_SYNC_SECRET", "");
    const res = await GET(makeRequest("Bearer "));
    expect(res.status).toBe(401);
  });

  it("returns empty results when no users are connected", async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });

  it("syncs connected users and returns results", async () => {
    const connectedUsers = [
      { id: 1, name: "Alan", stravaAthleteId: "111" },
      { id: 2, name: "Brian", stravaAthleteId: "222" },
    ];

    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(connectedUsers),
        }),
      }),
    });

    (syncUserActivities as any)
      .mockResolvedValueOnce({
        imported: 3,
        skipped: 1,
        skippedTypes: { Yoga: 1 },
        importedTypes: { run: 2, ride: 1 },
        totalPoints: 45.5,
      })
      .mockResolvedValueOnce({
        imported: 0,
        skipped: 0,
        skippedTypes: {},
        importedTypes: {},
        totalPoints: 0,
      });

    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.results[0]).toEqual({
      userId: 1,
      name: "Alan",
      imported: 3,
      skipped: 1,
      totalPoints: 45.5,
    });
    expect(body.results[1]).toEqual({
      userId: 2,
      name: "Brian",
      imported: 0,
      skipped: 0,
      totalPoints: 0,
    });
  });

  it("logs audit only when activities are imported", async () => {
    const connectedUsers = [
      { id: 1, name: "Alan", stravaAthleteId: "111" },
      { id: 2, name: "Brian", stravaAthleteId: "222" },
    ];

    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(connectedUsers),
        }),
      }),
    });

    (syncUserActivities as any)
      .mockResolvedValueOnce({
        imported: 2,
        skipped: 0,
        skippedTypes: {},
        importedTypes: { run: 2 },
        totalPoints: 30,
      })
      .mockResolvedValueOnce({
        imported: 0,
        skipped: 0,
        skippedTypes: {},
        importedTypes: {},
        totalPoints: 0,
      });

    await GET(makeRequest("Bearer test-secret"));

    // Only Alan had imports, so only 1 audit entry
    expect(logAudit).toHaveBeenCalledTimes(1);
    expect(logAudit).toHaveBeenCalledWith({
      userId: 1,
      action: "strava_sync",
      entityType: "activity",
      metadata: expect.objectContaining({
        imported: 2,
        triggeredBy: "cron",
      }),
    });
  });

  it("handles sync errors gracefully per user", async () => {
    const connectedUsers = [
      { id: 1, name: "Alan", stravaAthleteId: "111" },
      { id: 2, name: "Brian", stravaAthleteId: "222" },
    ];

    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(connectedUsers),
        }),
      }),
    });

    (syncUserActivities as any)
      .mockRejectedValueOnce(new Error("Token expired"))
      .mockResolvedValueOnce({
        imported: 1,
        skipped: 0,
        skippedTypes: {},
        importedTypes: { run: 1 },
        totalPoints: 15,
      });

    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.results).toHaveLength(2);
    // First user errored
    expect(body.results[0].error).toBe("Token expired");
    // Second user succeeded
    expect(body.results[1].imported).toBe(1);
  });
});
