import { NextResponse } from "next/server";
import { probeDatabase } from "@/backend/db-status";

/** Health check host / Cloudflare — không yêu cầu session. Fail nếu DB không trả lời. */
export async function GET() {
  const status = await probeDatabase();
  return NextResponse.json(
    {
      ok: status.ok,
      db: status.ok,
      host: status.hostKind,
      ...(status.ok ? {} : { error: status.code }),
    },
    { status: status.ok ? 200 : 503 },
  );
}
