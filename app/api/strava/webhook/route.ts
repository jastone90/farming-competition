import { NextResponse } from "next/server";
import { handleStravaEvent } from "@/lib/strava/webhook";

// Webhook verification
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Webhook event handler
export async function POST(request: Request) {
  const event = await request.json();

  // Process async - respond immediately
  handleStravaEvent(event).catch(console.error);

  return NextResponse.json({ received: true });
}
