import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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

export async function saveShopImageUpload(input: {
  shopId: string;
  bytes: Buffer;
  mimeType: string;
  originalName?: string;
}): Promise<SavedUpload> {
  if (!ALLOWED_IMAGE_MIME.has(input.mimeType)) {
    throw new Error("Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc GIF.");
  }
  if (input.bytes.byteLength === 0) {
    throw new Error("File ảnh trống.");
  }
  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("Ảnh tối đa 5MB.");
  }

  const id = randomUUID();
  const ext = EXT_BY_MIME[input.mimeType] ?? "bin";
  const relativePath = path.join(input.shopId, `${id}.${ext}`);
  const absolutePath = path.join(uploadsRootDir(), relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.bytes);

  const safeName = (input.originalName?.trim() || `image.${ext}`).slice(0, 120);

  return {
    id,
    shopId: input.shopId,
    fileName: safeName,
    mimeType: input.mimeType,
    relativePath: relativePath.replace(/\\/g, "/"),
    absolutePath,
    publicPath: `/api/uploads/${input.shopId}/${id}.${ext}`,
  };
}

export async function readShopUpload(shopId: string, fileName: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName) || fileName.includes("..")) {
    return null;
  }
  const absolutePath = path.join(uploadsRootDir(), shopId, fileName);
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
