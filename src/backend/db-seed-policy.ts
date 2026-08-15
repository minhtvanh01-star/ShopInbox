export type SeedMode = "replace" | "insert" | "skip";

/** Local `db:seed` ghi đè. Trên Railway/production chỉ seed khi DB trống. */
export function resolveSeedMode(
  env: Record<string, string | undefined>,
  shopCount: number,
): SeedMode {
  if (env.SEED_FORCE === "1") {
    return "replace";
  }

  const hosted = env.NODE_ENV === "production" || Boolean(env.RAILWAY_ENVIRONMENT);
  if (hosted) {
    return shopCount > 0 ? "skip" : "insert";
  }

  return "replace";
}
