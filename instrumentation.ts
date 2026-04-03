export async function register() {
  // Only run the scheduler on the server, not during builds or edge runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDailySyncScheduler } = await import(
      "./lib/strava/daily-sync-scheduler"
    );
    startDailySyncScheduler();
  }
}
