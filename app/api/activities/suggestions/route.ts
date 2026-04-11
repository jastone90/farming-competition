import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildSuggestions } from "@/lib/suggestions";
import { getSeasonForDate } from "@/lib/utils/season";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const currentSeason = getSeasonForDate(new Date());
  const suggestions = await buildSuggestions(session.id, currentSeason);
  return NextResponse.json({ suggestions });
}
