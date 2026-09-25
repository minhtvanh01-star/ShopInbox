import { NextResponse } from "next/server";
import { runDatabaseBackup } from "@/backend/db-backup-job";

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
    const result = await runDatabaseBackup();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[backup] cron failed", error);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
