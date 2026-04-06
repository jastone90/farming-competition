import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLog, users } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const action = url.searchParams.get("action");
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  const conditions = [];
  if (userId) conditions.push(eq(auditLog.userId, parseInt(userId)));
  if (action)
    conditions.push(
      eq(
        auditLog.action,
        action as
          | "activity_create"
          | "activity_delete"
          | "amendment_propose"
          | "amendment_withdraw"
          | "vote_cast"
          | "pin_change"
      )
    );

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: auditLog.id,
      userId: auditLog.userId,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      metadata: auditLog.metadata,
      isSketch: auditLog.isSketch,
      createdAt: auditLog.createdAt,
      userName: users.name,
      userColor: users.color,
    })
    .from(auditLog)
    .innerJoin(users, eq(auditLog.userId, users.id))
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);

  const parsed = rows.map((r) => ({
    ...r,
    metadata: JSON.parse(r.metadata),
  }));

  return NextResponse.json(parsed);
}
