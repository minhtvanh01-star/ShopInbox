import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { ALLOWED_IMAGE_MIME, sniffImageMime, validateUploadSize } from "@/lib/inbox-media";

export { ALLOWED_IMAGE_MIME, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/inbox-media";
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function uploadsRootDir() {
  const fromEnv = process.env.UPLOAD_DIR?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.join(process.cwd(), "storage", "uploads");
}

export type SavedUpload = {
  id: string;
  shopId: string;
  fileName: string;
  mimeType: string;
  relativePath: string;
  absolutePath: string;
  publicPath: string;
};

function isSafeUploadSegment(value: string) {
  return /^[a-zA-Z0-9._-]+$/.test(value) && !value.includes("..");
}

export function resolveShopUploadPath(shopId: string, fileName: string) {
  if (!isSafeUploadSegment(shopId) || !isSafeUploadSegment(fileName)) {
    return null;
  }
  const root = uploadsRootDir();
  const absolutePath = path.resolve(root, shopId, fileName);
  const relative = path.relative(root, absolutePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return absolutePath;
}

export async function saveShopImageUpload(input: {
  shopId: string;
  bytes: Buffer;
  mimeType: string;
  originalName?: string;
}): Promise<SavedUpload> {
  const sizeCheck = validateUploadSize(input.bytes.byteLength, "Ảnh");
  if (!sizeCheck.ok) {
    throw new Error(sizeCheck.error);
  }

  const sniffed = sniffImageMime(input.bytes);
  if (!sniffed || !ALLOWED_IMAGE_MIME.has(sniffed)) {
    throw new Error("Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc GIF.");
  }

  const id = randomUUID();
  const ext = EXT_BY_MIME[sniffed] ?? "bin";
  const fileName = `${id}.${ext}`;
  const absolutePath = resolveShopUploadPath(input.shopId, fileName);
  if (!absolutePath) {
    throw new Error("Shop không hợp lệ để lưu ảnh.");
  }
  const relativePath = path.join(input.shopId, fileName);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.bytes);

  const safeName = (input.originalName?.trim() || `image.${ext}`).slice(0, 120);

  return {
    id,
    shopId: input.shopId,
    fileName: safeName,
    mimeType: sniffed,
    relativePath: relativePath.replace(/\\/g, "/"),
    absolutePath,
    publicPath: `/api/uploads/${input.shopId}/${id}.${ext}`,
  };
}

export async function readShopUpload(shopId: string, fileName: string) {
  const absolutePath = resolveShopUploadPath(shopId, fileName);
  if (!absolutePath) {
    return null;
  }
  try {
    const bytes = await readFile(absolutePath);
    const ext = path.extname(fileName).slice(1).toLowerCase();
    const mime =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : ext === "gif"
              ? "image/gif"
              : "application/octet-stream";
    return { bytes, mimeType: mime };
  } catch {
    return null;
  }
}
