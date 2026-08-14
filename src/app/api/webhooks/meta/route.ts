import { NextResponse } from "next/server";
import { getMetaOAuthConfig } from "@/backend/oauth-config";

export async function GET(request: Request) {
  const config = getMetaOAuthConfig();
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    challenge &&
    config?.webhookVerifyToken &&
    token === config.webhookVerifyToken
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  if (mode === "subscribe" && challenge && !config?.webhookVerifyToken) {
    console.warn("[webhook/meta] META_WEBHOOK_VERIFY_TOKEN chưa cấu hình");
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  console.info("[webhook/meta] event", JSON.stringify(body));
  return NextResponse.json({ received: true });
}
