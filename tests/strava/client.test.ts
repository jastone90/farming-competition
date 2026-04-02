import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshTokenIfNeeded, getStravaActivities, getStravaActivity } from "@/lib/strava/client";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("refreshTokenIfNeeded", () => {
  it("returns existing tokens if not expired", async () => {
    const futureExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const result = await refreshTokenIfNeeded("access", "refresh", futureExpiry);

    expect(result).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: futureExpiry,
    });
    // Should NOT call fetch
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("refreshes tokens when expired", async () => {
    const pastExpiry = Math.floor(Date.now() / 1000) - 100; // expired
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new_access",
          refresh_token: "new_refresh",
          expires_at: 9999999999,
        }),
    });

    const result = await refreshTokenIfNeeded("old_access", "old_refresh", pastExpiry);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result).toEqual({
      accessToken: "new_access",
      refreshToken: "new_refresh",
      expiresAt: 9999999999,
    });
  });

  it("returns null when refresh fails", async () => {
    const pastExpiry = Math.floor(Date.now() / 1000) - 100;
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await refreshTokenIfNeeded("access", "refresh", pastExpiry);
    expect(result).toBeNull();
  });

  it("sends correct body to Strava OAuth endpoint", async () => {
    const pastExpiry = Math.floor(Date.now() / 1000) - 100;
    process.env.STRAVA_CLIENT_ID = "test_id";
    process.env.STRAVA_CLIENT_SECRET = "test_secret";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "new",
          refresh_token: "new_ref",
          expires_at: 9999999999,
        }),
    });

    await refreshTokenIfNeeded("access", "my_refresh_token", pastExpiry);

    expect(mockFetch).toHaveBeenCalledWith("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: "test_id",
        client_secret: "test_secret",
        grant_type: "refresh_token",
        refresh_token: "my_refresh_token",
      }),
    });
  });
});

describe("getStravaActivities", () => {
  it("fetches activities with auth header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
    });

    const result = await getStravaActivities("my_token", 1, 30);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/athlete/activities"),
      { headers: { Authorization: "Bearer my_token" } }
    );
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("includes after/before params when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await getStravaActivities("token", 1, 30, 1000, 2000);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("after=1000");
    expect(calledUrl).toContain("before=2000");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(getStravaActivities("token")).rejects.toThrow("Strava API error: 500");
  });
});

describe("getStravaActivity", () => {
  it("fetches a single activity by ID", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123, name: "Morning Run" }),
    });

    const result = await getStravaActivity("my_token", "123");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.strava.com/api/v3/activities/123",
      { headers: { Authorization: "Bearer my_token" } }
    );
    expect(result).toEqual({ id: 123, name: "Morning Run" });
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(getStravaActivity("token", "999")).rejects.toThrow("Strava API error: 404");
  });
});
