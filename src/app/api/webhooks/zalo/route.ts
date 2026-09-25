import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getZaloOAuthConfig } from "@/backend/oauth-config";
import { processZaloWebhook } from "@/backend/webhook-zalo";
import {
  isZaloWebhookTimestampFresh,
  verifyAndParseZaloWebhook,
  zaloWebhookVerifyTokenMatches,
} from "@/lib/zalo-webhook-security";

function zaloVerifyToken() {
  return process.env.ZALO_WEBHOOK_VERIFY_TOKEN?.trim() || "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get("challenge") ?? searchParams.get("verify");
  const token =
    searchParams.get("token") ??
    searchParams.get("verify_token") ??
    searchParams.get("hub.verify_token");

  if (challenge) {
    if (!zaloWebhookVerifyTokenMatches(token, zaloVerifyToken())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const config = getZaloOAuthConfig();
  if (!config) {
    console.warn("[webhook/zalo] ZALO_APP_SECRET chưa cấu hình — từ chối POST");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawBody = await request.text();
  const signature =
    request.headers.get("x-zevent-signature") ?? request.headers.get("X-ZEvent-Signature");

  let parsed: { timestamp?: string | number; time?: string | number } = {};
  try {
    parsed = JSON.parse(rawBody) as typeof parsed;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const verified = verifyAndParseZaloWebhook({
    rawBody,
    signatureHeader: signature,
    appId: config.appId,
    appSecret: config.appSecret,
    timestamp: parsed.timestamp ?? parsed.time,
  });
  if (!verified.ok) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  if (!isZaloWebhookTimestampFresh(verified.timestamp ?? parsed.timestamp ?? parsed.time)) {
    return NextResponse.json({ error: "Expired" }, { status: 403 });
  }

  try {
    const result = await processZaloWebhook(verified.event);
    if (result.processed > 0) {
      revalidatePath("/inbox");
      revalidatePath("/settings");
    }
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    console.error("[webhook/zalo] ingest error", err);
    return NextResponse.json({ received: true, error: "ingest_failed" }, { status: 500 });
  }
}
