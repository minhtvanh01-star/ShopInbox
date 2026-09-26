export type SeedMode = "replace" | "insert" | "skip";
export type SeedScope = "staff" | "full";

function isHosted(env: Record<string, string | undefined>) {
  return env.NODE_ENV === "production" || Boolean(env.RAILWAY_ENVIRONMENT);
}

/** Local `db:seed` ghi đè. Production / host chỉ seed khi DB trống. */
export function resolveSeedMode(
  env: Record<string, string | undefined>,
  shopCount: number,
): SeedMode {
  if (env.SEED_FORCE === "1") {
    return "replace";
  }

  if (isHosted(env)) {
    return shopCount > 0 ? "skip" : "insert";
  }

  return "replace";
}

/** Production mặc định chỉ shop + 2 nhân viên. Local seed đủ demo inbox. */
export function resolveSeedScope(
  env: Record<string, string | undefined>,
  argv: string[] = [],
): SeedScope {
  if (env.SEED_SCOPE === "full" || argv.includes("--full")) {
    return "full";
  }
  if (env.SEED_SCOPE === "staff" || argv.includes("--staff")) {
    return "staff";
  }
  return isHosted(env) ? "staff" : "full";
}
