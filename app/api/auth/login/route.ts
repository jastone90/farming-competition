import { NextResponse } from "next/server";
import { login } from "@/lib/auth";

export async function POST(request: Request) {
  const { name, pin } = await request.json();
  if (!name || !pin) {
    return NextResponse.json({ error: "Name and PIN required" }, { status: 400 });
  }
  const user = await login(name, pin);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  return NextResponse.json({ user });
}
