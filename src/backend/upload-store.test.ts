import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveShopUploadPath, uploadsRootDir } from "@/backend/upload-store";

describe("resolveShopUploadPath", () => {
  it("keeps files under the uploads root", () => {
    const resolved = resolveShopUploadPath("shop1", "abc.jpg");
    expect(resolved).toBe(path.join(uploadsRootDir(), "shop1", "abc.jpg"));
  });

  it("rejects traversal in shopId or fileName", () => {
    expect(resolveShopUploadPath("../etc", "abc.jpg")).toBeNull();
    expect(resolveShopUploadPath("shop1", "../secret.jpg")).toBeNull();
    expect(resolveShopUploadPath("shop1", "a/b.jpg")).toBeNull();
  });
});
