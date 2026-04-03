import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStartDailySyncScheduler = vi.fn();

vi.mock("@/lib/strava/daily-sync-scheduler", () => ({
  startDailySyncScheduler: mockStartDailySyncScheduler,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("instrumentation", () => {
  it("register() calls startDailySyncScheduler in nodejs runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    const { register } = await import("@/instrumentation");
    await register();

    expect(mockStartDailySyncScheduler).toHaveBeenCalledOnce();
  });

  it("register() does nothing outside nodejs runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");

    const { register } = await import("@/instrumentation");
    await register();

    expect(mockStartDailySyncScheduler).not.toHaveBeenCalled();
  });
});
