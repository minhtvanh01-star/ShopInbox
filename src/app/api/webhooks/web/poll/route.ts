import { NextResponse } from "next/server";
import { isKnownWebWidgetOrigin, listWebWidgetShopReplies } from "@/backend/web-widget";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { isWebWidgetVisitorId, webWidgetCorsHeaders } from "@/lib/web-widget";

function requestOrigin(request: Request) {
  return request.headers.get("origin");
}

function json(body: unknown, status: number, origin: string | null, allowed: boolean) {
  return NextResponse.json(body, {
    status,
    headers: webWidgetCorsHeaders(origin, allowed),
  });
}

export async function OPTIONS(request: Request) {
  const origin = requestOrigin(request);
  const allowed = await isKnownWebWidgetOrigin(origin);
  return new NextResponse(null, {
    status: allowed ? 204 : 403,
    headers: webWidgetCorsHeaders(origin, allowed),
  });
}

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const url = new URL(request.url);
  const key = request.headers.get("x-shopinbox-key")?.trim() || "";
  const visitorId = url.searchParams.get("visitorId")?.trim() || "";
  const after = url.searchParams.get("after");

  if (!isWebWidgetVisitorId(visitorId)) {
    return json({ error: "visitor_id" }, 400, origin, await isKnownWebWidgetOrigin(origin));
  }

  const result = await listWebWidgetShopReplies({
    key,
    origin,
    ip: clientIpFromHeaders((name) => request.headers.get(name)),
    visitorId,
    after,
  });

  if (!result.ok) {
    const allowed = result.error !== "origin" && result.error !== "unauthorized";
    return json({ error: result.error }, result.status, origin, allowed);
  }

  return json({ messages: result.messages }, 200, origin, true);
}
