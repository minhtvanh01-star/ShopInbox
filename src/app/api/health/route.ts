import { NextResponse } from "next/server";

/** Health check host / Cloudflare — không yêu cầu session hay Cloudflare. */
export function GET() {
  return NextResponse.json({ ok: true });
}
