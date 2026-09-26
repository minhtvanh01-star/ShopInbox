import { NextResponse } from "next/server";
import { ingestWebWidgetMessage, isKnownWebWidgetOrigin } from "@/backend/web-widget";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { webWidgetCorsHeaders } from "@/lib/web-widget";

function requestOrigin(request: Request) {
  return request.headers.get("origin");
}

function widgetKey(request: Request, body: { key?: unknown }) {
  return (
    request.headers.get("x-shopinbox-key")?.trim() ||
    (typeof body.key === "string" ? body.key.trim() : "")
  );
}

function json(
  body: unknown,
  status: number,
  origin: string | null,
  allowed: boolean,
) {
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

export async function POST(request: Request) {
  const origin = requestOrigin(request);
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400, origin, await isKnownWebWidgetOrigin(origin));
  }

  const result = await ingestWebWidgetMessage({
    key: widgetKey(request, body),
    origin,
    ip: clientIpFromHeaders((name) => request.headers.get(name)),
    visitorId: body.visitorId,
    text: body.text,
    name: body.name,
    externalMessageId: body.externalMessageId,
  });

  const allowed = result.ok || result.error !== "origin";
  if (!result.ok) {
    return json({ error: result.error }, result.status, origin, allowed && result.error !== "unauthorized");
  }

  return json({ ok: true, duplicate: result.duplicate }, 200, origin, true);
}
