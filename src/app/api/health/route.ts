import { NextResponse } from "next/server";
import { prisma } from "@/backend/prisma";

/** Health check host / Cloudflare — không yêu cầu session. Fail nếu DB không trả lời. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
