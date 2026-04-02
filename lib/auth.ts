/**
 * Cookie-based session management.
 *
 * Simple PIN-based auth: users enter name + 4-digit PIN to log in.
 * Session is stored as an httpOnly cookie containing just the user ID.
 * No JWT, no server-side session store — the user ID in the cookie is
 * looked up against the DB on every request via getSession().
 */
import { cookies } from "next/headers";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

const SESSION_COOKIE = "farming_session";

export async function login(name: string, pin: string) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.name, name))
    .get();

  if (!user || user.pin !== pin) {
    return null;
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, String(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return { id: user.id, name: user.name, color: user.color };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  if (!sessionCookie?.value) return null;

  const userId = parseInt(sessionCookie.value, 10);
  if (isNaN(userId)) return null;

  const user = await db
    .select({
      id: users.id,
      name: users.name,
      color: users.color,
      stravaAthleteId: users.stravaAthleteId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  return user ?? null;
}
