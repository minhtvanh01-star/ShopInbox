import { isLoopbackHost } from "@/lib/security-headers";

export type DatabaseUrlKind = "unset" | "invalid" | "loopback" | "remote";

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
  invalid_url: "DATABASE_URL không phải URI Postgres hợp lệ. Kiểm tra lại chuỗi trên VPS.",
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

/** Bỏ ngoặc/khoảng trắng khi dán URI từ panel. */
export function stripDatabaseUrl(raw: string | undefined | null) {
  let value = String(raw ?? "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

export function inspectDatabaseUrl(raw: string | undefined | null): {
  configured: boolean;
  kind: DatabaseUrlKind;
  sslMode: string | null;
} {
  const value = stripDatabaseUrl(raw);
  if (!value) return { configured: false, kind: "unset", sslMode: null };
  try {
    const url = new URL(value);
    if (!/^postgres(ql)?:$/i.test(url.protocol) || !url.hostname) {
      return { configured: true, kind: "invalid", sslMode: null };
    }
    return {
      configured: true,
      kind: isLoopbackHost(url.hostname) ? "loopback" : "remote",
      sslMode: url.searchParams.get("sslmode")?.toLowerCase() ?? null,
    };
  } catch {
    return { configured: true, kind: "invalid", sslMode: null };
  }
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
  raw: string | undefined | null,
  env: Record<string, string | undefined> = process.env,
) {
  const connectionString = stripDatabaseUrl(raw);
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
  const info = inspectDatabaseUrl(env.DATABASE_URL);
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
