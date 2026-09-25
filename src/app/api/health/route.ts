import { NextResponse } from "next/server";

/** Railway / Cloudflare health — không yêu cầu session hay Cloudflare. */
export function GET() {
  return NextResponse.json({ ok: true });
}
