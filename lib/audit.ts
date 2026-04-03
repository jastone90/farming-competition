import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

type AuditAction =
  | "activity_create"
  | "activity_delete"
  | "amendment_propose"
  | "amendment_withdraw"
  | "vote_cast"
  | "pin_change"
  | "user_create"
  | "color_change";

type AuditEntityType = "activity" | "amendment" | "vote" | "user";

interface LogAuditParams {
  userId: number;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: number;
  metadata?: Record<string, unknown>;
  isSketch?: boolean;
}

export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  metadata,
  isSketch,
}: LogAuditParams): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata: metadata ? JSON.stringify(metadata) : "{}",
      isSketch: isSketch ?? false,
    });
  } catch (err) {
    console.error("[audit] Failed to log:", err);
  }
}
