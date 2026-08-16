import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { processZaloWebhook } from "@/backend/webhook-zalo";

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
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await processZaloWebhook(body);
    if (result.processed > 0) {
      revalidatePath("/inbox");
      revalidatePath("/settings");
    }
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    console.error("[webhook/zalo] ingest error", err);
    return NextResponse.json({ received: true, error: "ingest_failed" });
  }
}
