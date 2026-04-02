/**
 * Shared Strava token management.
 *
 * Refreshes expired tokens and persists new ones to the database.
 * Used by: Strava sync route, Strava webhook handler.
 * If you change token refresh logic, update it HERE — both consumers share this.
 */
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { refreshTokenIfNeeded } from "./client";

interface UserWithTokens {
  id: number;
  stravaAccessToken: string | null;
  stravaRefreshToken: string | null;
  stravaTokenExpiresAt: number | null;
}

/**
 * Ensures the user has a valid (non-expired) Strava access token.
 * If the token was refreshed, persists the new tokens to the DB.
 *
 * @returns Fresh access token string, or null if refresh failed or tokens missing.
 */
export async function ensureFreshTokens(
  user: UserWithTokens
): Promise<string | null> {
  if (!user.stravaAccessToken || !user.stravaRefreshToken || !user.stravaTokenExpiresAt) {
    return null;
  }

  const tokens = await refreshTokenIfNeeded(
    user.stravaAccessToken,
    user.stravaRefreshToken,
    user.stravaTokenExpiresAt
  );

  if (!tokens) return null;

  // Persist refreshed tokens if they changed
  if (tokens.accessToken !== user.stravaAccessToken) {
    await db
      .update(users)
      .set({
        stravaAccessToken: tokens.accessToken,
        stravaRefreshToken: tokens.refreshToken,
        stravaTokenExpiresAt: tokens.expiresAt,
      })
      .where(eq(users.id, user.id));
  }

  return tokens.accessToken;
}
