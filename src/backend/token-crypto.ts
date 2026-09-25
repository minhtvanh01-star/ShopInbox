import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function keyFromSecret() {
  const dedicated = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  const secret = dedicated || process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error("Thiếu TOKEN_ENCRYPTION_KEY hoặc SESSION_SECRET (tối thiểu 16 ký tự) để mã hóa token kênh.");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

/** Mã hóa token kênh at-rest. Giá trị đã mã hóa giữ nguyên. */
export function sealSecret(plain: string | null | undefined): string | null {
  if (plain == null) return null;
  const value = plain.trim();
  if (!value) return null;
  if (value.startsWith(PREFIX)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

/** Giải mã token. Bản plaintext cũ (chưa seal) trả nguyên. */
export function openSecret(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith(PREFIX)) return trimmed;

  const payload = trimmed.slice(PREFIX.length);
  const [ivPart, tagPart, dataPart] = payload.split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Token kênh mã hóa không hợp lệ.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFromSecret(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}
