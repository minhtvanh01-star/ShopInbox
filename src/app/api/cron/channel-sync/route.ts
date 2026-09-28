import { NextResponse } from "next/server";
import { runChannelSyncSweep } from "@/backend/channel-sync-sweep";
import { getChannelSyncSettings, markChannelSyncRan } from "@/backend/platform-channel-sync";
import { dueForChannelSync } from "@/lib/channel-sync";

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const settings = await getChannelSyncSettings();
    if (!settings.enabled) {
      return NextResponse.json({ ok: true, skipped: true, reason: "disabled" });
    }
    if (!dueForChannelSync(settings)) {
      return NextResponse.json({ ok: true, skipped: true, reason: "not_due" });
    }
    const result = await runChannelSyncSweep();
    if (!result.skipped) {
      await markChannelSyncRan();
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[channel-sync] cron failed", error);
    return NextResponse.json({ error: "Channel sync failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
