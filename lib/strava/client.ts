interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const STRAVA_API_BASE = "https://www.strava.com/api/v3";

export async function refreshTokenIfNeeded(
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): Promise<StravaTokens | null> {
  if (Date.now() / 1000 < expiresAt) {
    return { accessToken, refreshToken, expiresAt };
  }

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };
}

export async function getStravaActivities(
  accessToken: string,
  page = 1,
  perPage = 30,
  after?: number,
  before?: number,
) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  if (after) params.set("after", String(after));
  if (before) params.set("before", String(before));

  const res = await fetch(
    `${STRAVA_API_BASE}/athlete/activities?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Strava API error: ${res.status}`);
  return res.json();
}

export async function getStravaActivity(accessToken: string, activityId: string) {
  const res = await fetch(`${STRAVA_API_BASE}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Strava API error: ${res.status}`);
  return res.json();
}
