/** IP client — ưu tiên Cloudflare khi web đứng sau proxy. */

export function clientIpFromHeaders(getHeader: (name: string) => string | null | undefined) {
  const cf = getHeader("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = getHeader("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = getHeader("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || undefined;
}
