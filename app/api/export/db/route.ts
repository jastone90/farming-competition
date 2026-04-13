import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readFileSync } from "fs";
import { resolve } from "path";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const dbUrl = process.env.DATABASE_URL || "file:./farming.db";
  if (!dbUrl.startsWith("file:")) {
    return NextResponse.json(
      { error: "Export not supported for remote databases" },
      { status: 400 }
    );
  }

  const filePath = resolve(process.cwd(), dbUrl.replace(/^file:/, ""));

  let fileBuffer: Buffer;
  try {
    fileBuffer = readFileSync(filePath);
  } catch {
    return NextResponse.json(
      { error: "Database file not found" },
      { status: 404 }
    );
  }

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": "application/x-sqlite3",
      "Content-Disposition": 'attachment; filename="farming.db"',
      "Cache-Control": "no-store",
    },
  });
}
