import { lookup } from "node:dns/promises";
import { getWebWidgetScriptUrl } from "@/backend/oauth-config";
import { prisma } from "@/backend/prisma";
import {
  detectInstalledChat,
  formatWebsiteCheckMessage,
  isPrivateIpAddress,
  isSameWebsiteCheckHost,
  parseWebsiteCheckUrl,
} from "@/lib/website-check";

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 512_000;
const MAX_REDIRECTS = 3;

export type WebsiteWidgetCheckResult =
  | {
      ok: true;
      found: boolean;
      matchedKey: boolean;
      otherChats: string[];
      checkedUrl: string;
      message: string;
    }
  | { ok: false; error: string };

async function assertPublicResolvedHost(host: string) {
  const rows = await lookup(host, { all: true, verbatim: true });
  const addresses = rows.map((row) => row.address);
  if (addresses.length === 0) {
    throw new Error("Không phân giải được tên miền.");
  }
  if (addresses.some((ip) => isPrivateIpAddress(ip))) {
    throw new Error("Tên miền trỏ về địa chỉ nội bộ — bỏ qua.");
  }
}

async function readLimitedText(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) {
    return (await response.text()).slice(0, MAX_HTML_BYTES);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export async function fetchPublicWebsiteHtml(rawUrl: string) {
  let current = parseWebsiteCheckUrl(rawUrl);
  if (!current.ok) {
    return current;
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    try {
      await assertPublicResolvedHost(current.host);
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Không kiểm tra được tên miền.",
      };
    }

    let response: Response;
    try {
      response = await fetch(current.href, {
        method: "GET",
        redirect: "manual",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "ShopInbox-WidgetCheck/1.0",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      return { ok: false as const, error: "timeout" };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || hop === MAX_REDIRECTS) {
        return { ok: false as const, error: "timeout" };
      }
      const next = parseWebsiteCheckUrl(new URL(location, current.href).toString());
      if (!next.ok) return next;
      if (!isSameWebsiteCheckHost(current.host, next.host)) {
        return { ok: false as const, error: "Không theo chuyển hướng sang tên miền khác." };
      }
      try {
        await assertPublicResolvedHost(next.host);
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : "Không kiểm tra được tên miền.",
        };
      }
      current = next;
      continue;
    }

    if (!response.ok) {
      return { ok: false as const, error: "timeout" };
    }

    const html = await readLimitedText(response);
    return { ok: true as const, html, finalUrl: current.href };
  }

  return { ok: false as const, error: "timeout" };
}

export async function checkWebsiteWidgetInstall(input: {
  shopId: string;
  url?: string | null;
}): Promise<WebsiteWidgetCheckResult> {
  const account = await prisma.channelAccount.findUnique({
    where: { shopId_channel: { shopId: input.shopId, channel: "web" } },
    select: { pageId: true, webhookSecret: true },
  });

  const parsed = parseWebsiteCheckUrl(input.url || account?.pageId);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const fetched = await fetchPublicWebsiteHtml(parsed.href);
  if (!fetched.ok) {
    if (fetched.error === "timeout") {
      return {
        ok: true,
        found: false,
        matchedKey: false,
        otherChats: [],
        checkedUrl: parsed.href,
        message: formatWebsiteCheckMessage({
          found: false,
          matchedKey: false,
          otherChats: [],
          checkedUrl: parsed.href,
          fetchFailed: true,
        }),
      };
    }
    return { ok: false, error: fetched.error };
  }

  const detected = detectInstalledChat(fetched.html, {
    scriptUrl: getWebWidgetScriptUrl(),
    widgetKey: account?.webhookSecret,
  });

  return {
    ok: true,
    found: detected.shopInbox,
    matchedKey: detected.matchedKey,
    otherChats: detected.otherChats,
    checkedUrl: fetched.finalUrl,
    message: formatWebsiteCheckMessage({
      found: detected.shopInbox,
      matchedKey: detected.matchedKey,
      otherChats: detected.otherChats,
      checkedUrl: fetched.finalUrl,
    }),
  };
}
