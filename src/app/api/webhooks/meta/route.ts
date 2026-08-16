import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getMetaOAuthConfig } from "@/backend/oauth-config";
import { processMetaWebhook } from "@/backend/webhook-meta";

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
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await processMetaWebhook(body);
    if (result.processed > 0 || result.touched > 0) {
      revalidatePath("/inbox");
      revalidatePath("/settings");
    }
    if (result.processed === 0 && result.touched === 0 && !result.skipped) {
      console.warn("[webhook/meta] received but no channel matched", {
        object: (body as { object?: string }).object,
        entryIds: Array.isArray((body as { entry?: Array<{ id?: string }> }).entry)
          ? (body as { entry: Array<{ id?: string }> }).entry.map((entry) => entry.id)
          : [],
      });
    }
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    console.error("[webhook/meta] ingest error", err);
    return NextResponse.json({ received: true, error: "ingest_failed" });
  }
}
