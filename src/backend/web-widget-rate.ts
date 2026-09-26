import {
  WEB_WIDGET_POLL_LIMIT,
  WEB_WIDGET_POLL_WINDOW_MS,
  WEB_WIDGET_POST_LIMIT,
  WEB_WIDGET_POST_WINDOW_MS,
  consumeWebWidgetRateLimit,
  webWidgetRateBucketKey,
} from "@/lib/web-widget";

const buckets = new Map<string, number[]>();

export function resetWebWidgetRateLimitForTests() {
  buckets.clear();
}

export function consumeWebWidgetRequestLimit(input: {
  action: "post" | "poll";
  key: string;
  ip?: string;
  visitorId: string;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const bucketKey = webWidgetRateBucketKey({
    action: input.action,
    key: input.key,
    ip: input.ip ?? "",
    visitorId: input.visitorId,
  });
  const limit = input.action === "post" ? WEB_WIDGET_POST_LIMIT : WEB_WIDGET_POLL_LIMIT;
  const windowMs = input.action === "post" ? WEB_WIDGET_POST_WINDOW_MS : WEB_WIDGET_POLL_WINDOW_MS;
  const result = consumeWebWidgetRateLimit(buckets.get(bucketKey), now, limit, windowMs);
  buckets.set(bucketKey, result.next);
  return result.ok;
}
