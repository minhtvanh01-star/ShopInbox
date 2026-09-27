/** Không import @/ — prisma.config.ts load file này lúc `prisma generate`. */
function isLoopbackDatabaseHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export type DatabaseUrlKind = "unset" | "invalid" | "loopback" | "remote";

export type DatabaseUrlHint = "empty" | "not_postgres_scheme" | "missing_host" | "unparseable" | "ok";

export type DatabaseUrlSource =
  | "database_url"
  | "db_uri"
  | "db_url"
  | "database_connection"
  | "composed"
  | "none";

export type DatabaseErrorCode =
  | "missing_url"
  | "invalid_url"
  | "loopback"
  | "econnrefused"
  | "enotfound"
  | "etimedout"
  | "auth"
  | "ssl"
  | "schema"
  | "unknown";

export const DATABASE_ERROR_MESSAGES: Record<DatabaseErrorCode, string> = {
  missing_url:
    "Thiếu DATABASE_URL trên server. Dán URI Postgres của panel (không dùng 127.0.0.1) rồi triển khai lại.",
  invalid_url:
    "DATABASE_URL không đọc được. Trên VibeHost mở DB_URI, hoặc ghi đè DATABASE_URL = postgresql://USER:PASSWORD@DB_HOST:DB_PORT/DB_NAME (mật khẩu có % @ # thì phải encode).",
  loopback:
    "DATABASE_URL đang trỏ localhost. Trên VPS phải dán URI Postgres host cấp, không dùng 127.0.0.1.",
  econnrefused: "Postgres từ chối kết nối. Kiểm tra host, cổng và service đang chạy.",
  enotfound: "Không tìm thấy máy chủ Postgres trong DATABASE_URL. Kiểm tra hostname.",
  etimedout: "Hết thời gian chờ Postgres. Kiểm tra firewall hoặc security group.",
  auth: "Sai user hoặc mật khẩu Postgres trong DATABASE_URL.",
  ssl: "Postgres yêu cầu SSL. Thêm ?sslmode=no-verify vào DATABASE_URL hoặc đặt DATABASE_SSL=1.",
  schema: "Đã kết nối Postgres nhưng chưa migrate. Restart app để chạy prisma migrate deploy.",
  unknown:
    "Server chưa kết nối được cơ sở dữ liệu. Trên VPS kiểm tra DATABASE_URL (Postgres) rồi triển khai lại.",
};

function unwrapQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith("`") && trimmed.endsWith("`"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Bỏ BOM, ngoặc, prefix DATABASE_URL= khi dán từ panel. */
export function stripDatabaseUrl(raw: string | undefined | null) {
  let value = unwrapQuotes(String(raw ?? "").replace(/^\uFEFF/, "").replace(/[\r\n]+/g, ""));
  if (/^DATABASE_URL\s*=/i.test(value)) {
    value = unwrapQuotes(value.replace(/^DATABASE_URL\s*=\s*/i, ""));
  }
  return value;
}

function buildPostgresUri(input: {
  host: string;
  port?: string;
  user?: string;
  password?: string;
  database?: string;
  sslmode?: string;
}) {
  const host = input.host.trim();
  if (!host) return "";
  const user = input.user?.trim() || "postgres";
  const password = input.password ?? "";
  const port = input.port?.trim() || "5432";
  const database = input.database?.trim() || "postgres";
  const auth = password
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
    : encodeURIComponent(user);
  const uri = `postgresql://${auth}@${host}:${port}/${encodeURIComponent(database)}`;
  return input.sslmode ? `${uri}?sslmode=${encodeURIComponent(input.sslmode)}` : uri;
}

function fromJsonConnection(value: string) {
  if (!value.startsWith("{")) return null;
  try {
    const row = JSON.parse(value) as Record<string, unknown>;
    const host = String(row.host ?? row.hostname ?? row.server ?? "").trim();
    if (!host) return null;
    return buildPostgresUri({
      host,
      port: String(row.port ?? ""),
      user: String(row.user ?? row.username ?? row.USER ?? ""),
      password: String(row.password ?? row.PASSWORD ?? ""),
      database: String(row.database ?? row.dbname ?? row.DB ?? ""),
      sslmode: String(row.sslmode ?? ""),
    });
  } catch {
    return null;
  }
}

function fromKeywordPairs(value: string) {
  if (!/\b(?:host|server|hostname|user\s*id)\s*=/i.test(value)) return null;
  const parts = value.includes(";") ? value.split(";") : value.split(/\s+/);
  const pairs = new Map<string, string>();
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase().replace(/\s+/g, "");
    pairs.set(key, part.slice(eq + 1));
  }
  const host = pairs.get("host") ?? pairs.get("server") ?? pairs.get("hostname");
  if (!host) return null;
  return buildPostgresUri({
    host,
    port: pairs.get("port"),
    user: pairs.get("user") ?? pairs.get("username") ?? pairs.get("userid") ?? pairs.get("uid"),
    password: pairs.get("password") ?? pairs.get("pwd"),
    database: pairs.get("dbname") ?? pairs.get("database"),
    sslmode: pairs.get("sslmode"),
  });
}

/** Mật khẩu có %, @, #, khoảng trắng — new URL() ném; encode lại userinfo. */
export function repairPostgresUri(value: string) {
  const scheme = value.match(/^(postgres(?:ql)?:\/\/)/i)?.[1];
  if (!scheme) return "";
  const rest = value.slice(scheme.length);
  const at = rest.lastIndexOf("@");
  if (at <= 0) return "";
  const userinfo = rest.slice(0, at);
  const hostAndAfter = rest.slice(at + 1);
  const hostMatch = hostAndAfter.match(/^(\[[^\]]+\]|[^/?#:]+)(?::(\d+))?([/?#].*)?$/);
  if (!hostMatch?.[1]) return "";
  const colon = userinfo.indexOf(":");
  const repaired = buildPostgresUri({
    host: hostMatch[1],
    port: hostMatch[2],
    user: safeDecode(colon === -1 ? userinfo : userinfo.slice(0, colon)),
    password: colon === -1 ? "" : safeDecode(userinfo.slice(colon + 1)),
    database: hostMatch[3]?.replace(/^[/?]/, "").split(/[?#]/)[0] || "postgres",
    sslmode: new URLSearchParams(hostMatch[3]?.split("?")[1]?.split("#")[0] ?? "").get("sslmode") ?? undefined,
  });
  try {
    const url = new URL(repaired);
    return url.hostname ? repaired : "";
  } catch {
    return "";
  }
}

/** Đưa chuỗi panel về URI postgresql:// mà `pg` đọc được. */
export function normalizeDatabaseUrl(raw: string | undefined | null) {
  let value = stripDatabaseUrl(raw);
  if (!value) return "";
  const fromJson = fromJsonConnection(value);
  if (fromJson) return fromJson;
  const fromPairs = fromKeywordPairs(value);
  if (fromPairs) return fromPairs;
  value = value.replace(/^jdbc:/i, "");
  if (/^prisma\+postgres(ql)?:/i.test(value)) {
    value = value.replace(/^prisma\+postgres(ql)?:/i, "postgresql:");
  }
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value) && value.includes("@")) {
    value = `postgresql://${value}`;
  }
  return repairPostgresUri(value) || value;
}

function composeDatabaseUrl(env: Record<string, string | undefined>) {
  const host = stripDatabaseUrl(env.DB_HOST ?? env.POSTGRES_HOST);
  const database = stripDatabaseUrl(env.DB_NAME ?? env.POSTGRES_DB ?? env.POSTGRES_DATABASE);
  if (!host || !database) return "";
  return buildPostgresUri({
    host,
    port: stripDatabaseUrl(env.DB_PORT ?? env.POSTGRES_PORT),
    user:
      stripDatabaseUrl(env.DB_USER ?? env.DB_USERNAME ?? env.POSTGRES_USER ?? env.DATABASE_USER) ||
      "postgres",
    password: stripDatabaseUrl(env.DB_PASSWORD ?? env.POSTGRES_PASSWORD),
    database,
  });
}

export function inspectDatabaseUrl(raw: string | undefined | null): {
  configured: boolean;
  kind: DatabaseUrlKind;
  sslMode: string | null;
  hint: DatabaseUrlHint;
} {
  const stripped = stripDatabaseUrl(raw);
  if (!stripped) return { configured: false, kind: "unset", sslMode: null, hint: "empty" };
  const value = normalizeDatabaseUrl(stripped);
  try {
    const url = new URL(value);
    if (!/^postgres(ql)?:$/i.test(url.protocol)) {
      return { configured: true, kind: "invalid", sslMode: null, hint: "not_postgres_scheme" };
    }
    if (!url.hostname) {
      return { configured: true, kind: "invalid", sslMode: null, hint: "missing_host" };
    }
    return {
      configured: true,
      kind: isLoopbackDatabaseHost(url.hostname) ? "loopback" : "remote",
      sslMode: url.searchParams.get("sslmode")?.toLowerCase() ?? null,
      hint: "ok",
    };
  } catch {
    return { configured: true, kind: "invalid", sslMode: null, hint: "unparseable" };
  }
}

function firstUsable(
  candidates: Array<[DatabaseUrlSource, string | undefined | null]>,
): { url: string; source: DatabaseUrlSource } {
  for (const [source, candidate] of candidates) {
    const normalized = normalizeDatabaseUrl(candidate);
    if (inspectDatabaseUrl(normalized).hint === "ok") {
      return { url: normalized, source };
    }
  }
  return { url: "", source: "none" };
}

/** VibeHost: DATABASE_URL tự sinh đôi khi gãy — lấy DB_URI / DB_URL hoặc ghép DB_*. */
export function resolveDatabaseUrlDetails(env: Record<string, string | undefined> = process.env) {
  return firstUsable([
    ["database_url", env.DATABASE_URL],
    ["db_uri", env.DB_URI],
    ["db_url", env.DB_URL],
    ["database_connection", env.DATABASE_CONNECTION],
    ["composed", composeDatabaseUrl(env)],
  ]);
}

export function resolveDatabaseUrl(env: Record<string, string | undefined> = process.env) {
  return resolveDatabaseUrlDetails(env).url;
}

export function databaseEnvPresence(env: Record<string, string | undefined> = process.env) {
  return {
    databaseUrl: Boolean(stripDatabaseUrl(env.DATABASE_URL)),
    dbUri: Boolean(stripDatabaseUrl(env.DB_URI)),
    dbUrl: Boolean(stripDatabaseUrl(env.DB_URL)),
    dbHost: Boolean(stripDatabaseUrl(env.DB_HOST ?? env.POSTGRES_HOST)),
    dbName: Boolean(stripDatabaseUrl(env.DB_NAME ?? env.POSTGRES_DB ?? env.POSTGRES_DATABASE)),
    dbPassword: Boolean(stripDatabaseUrl(env.DB_PASSWORD ?? env.POSTGRES_PASSWORD)),
    dbUser: Boolean(
      stripDatabaseUrl(env.DB_USER ?? env.DB_USERNAME ?? env.POSTGRES_USER ?? env.DATABASE_USER),
    ),
  };
}

export function shouldUseDatabaseSsl(
  connectionString: string,
  env: Record<string, string | undefined> = process.env,
) {
  if (env.DATABASE_SSL === "0") return false;
  if (env.DATABASE_SSL === "1") return true;
  const mode = inspectDatabaseUrl(connectionString).sslMode;
  if (mode === "disable" || mode === "allow") return false;
  return (
    mode === "require" ||
    mode === "no-verify" ||
    mode === "prefer" ||
    mode === "verify-ca" ||
    mode === "verify-full"
  );
}

export function prismaPgConfig(
  raw: string | undefined | null = process.env.DATABASE_URL,
  env: Record<string, string | undefined> = process.env,
) {
  const fromRaw = normalizeDatabaseUrl(raw);
  const connectionString =
    inspectDatabaseUrl(fromRaw).hint === "ok" ? fromRaw : resolveDatabaseUrl(env);
  if (!connectionString) {
    throw new Error("Thiếu DATABASE_URL. Copy .env.example thành .env.");
  }
  if (!shouldUseDatabaseSsl(connectionString, env)) {
    return { connectionString };
  }
  const mode = inspectDatabaseUrl(connectionString).sslMode;
  return {
    connectionString,
    ssl: {
      rejectUnauthorized: mode === "verify-full" || mode === "verify-ca",
    },
  };
}

export function classifyDatabaseError(error: unknown): DatabaseErrorCode {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (/Thiếu DATABASE_URL/i.test(message)) return "missing_url";
  if (code === "ECONNREFUSED" || /ECONNREFUSED|Connection refused/i.test(message)) {
    return "econnrefused";
  }
  if (code === "ENOTFOUND" || /ENOTFOUND|getaddrinfo/i.test(message)) return "enotfound";
  if (code === "ETIMEDOUT" || /timeout expired|ETIMEDOUT/i.test(message)) return "etimedout";
  if (/password authentication failed|28P01|SASL/i.test(message)) return "auth";
  if (/SSL|self[- ]signed|certificate/i.test(message)) return "ssl";
  if (/P2021|P2022|does not exist|Unknown (?:arg|field|argument)/i.test(message)) {
    return "schema";
  }
  return "unknown";
}

export function databaseErrorMessage(
  error: unknown,
  env: Record<string, string | undefined> = process.env,
) {
  const info = inspectDatabaseUrl(resolveDatabaseUrl(env) || env.DATABASE_URL);
  if (info.kind === "unset") return DATABASE_ERROR_MESSAGES.missing_url;
  if (info.kind === "invalid") return DATABASE_ERROR_MESSAGES.invalid_url;
  const classified = classifyDatabaseError(error);
  if (
    env.NODE_ENV === "production" &&
    info.kind === "loopback" &&
    classified !== "auth" &&
    classified !== "ssl" &&
    classified !== "schema"
  ) {
    return DATABASE_ERROR_MESSAGES.loopback;
  }
  return DATABASE_ERROR_MESSAGES[classified];
}
