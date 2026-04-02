import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scoringEngineVersions } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const versions = await db
    .select()
    .from(scoringEngineVersions)
    .orderBy(desc(scoringEngineVersions.id));

  return NextResponse.json(versions);
}
