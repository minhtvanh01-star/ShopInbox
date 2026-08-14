import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get("challenge") ?? searchParams.get("verify");

  if (challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ ok: true, endpoint: "zalo-webhook" });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  console.info("[webhook/zalo] event", JSON.stringify(body));
  return NextResponse.json({ received: true });
}
