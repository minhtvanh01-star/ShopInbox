import { describe, expect, it } from "vitest";
import { metaReactionAction } from "@/backend/meta-oauth";
import { ALLOWED_IMAGE_MIME, MAX_UPLOAD_BYTES } from "@/backend/upload-store";

describe("metaReactionAction", () => {
  it("maps emoji to Meta reaction codes", () => {
    expect(metaReactionAction("❤️")).toBe("love");
    expect(metaReactionAction("😂")).toBe("laugh");
    expect(metaReactionAction("❓")).toBe("other");
  });
});

describe("upload limits", () => {
  it("allows common image mime types under 100MB", () => {
    expect(ALLOWED_IMAGE_MIME.has("image/png")).toBe(true);
    expect(MAX_UPLOAD_BYTES).toBe(100 * 1024 * 1024);
  });
});
