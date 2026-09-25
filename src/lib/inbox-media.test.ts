import { describe, expect, it } from "vitest";
import {
  isMediaPlaceholderText,
  MAX_UPLOAD_BYTES,
  MESSAGE_TEXT_MAX,
  parseOutboundMessageText,
  sniffImageMime,
  sniffSpreadsheetKind,
  validateImageFileForUpload,
  validateSpreadsheetFileForUpload,
} from "./inbox-media";

describe("validateImageFileForUpload", () => {
  it("chấp nhận png nhỏ", () => {
    expect(validateImageFileForUpload({ type: "image/png", size: 1024 })).toEqual({ ok: true });
  });

  it("từ chối mime / size", () => {
    expect(validateImageFileForUpload({ type: "video/mp4", size: 100 }).ok).toBe(false);
    expect(validateImageFileForUpload({ type: "image/png", size: 0 }).ok).toBe(false);
    expect(
      validateImageFileForUpload({ type: "image/png", size: MAX_UPLOAD_BYTES + 1 }).ok,
    ).toBe(false);
  });
});

describe("sniffImageMime", () => {
  it("nhận JPEG / PNG / GIF / WebP", () => {
    expect(sniffImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(
      "image/jpeg",
    );
    expect(sniffImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(
      "image/png",
    );
    expect(sniffImageMime(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(
      "image/gif",
    );
    expect(
      sniffImageMime(
        Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe("image/webp");
    expect(sniffImageMime(Uint8Array.from([0x00, 0x01, 0x02, 0x03, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });
});

describe("validateSpreadsheetFileForUpload", () => {
  it("chấp nhận xlsx trong hạn mức", () => {
    expect(
      validateSpreadsheetFileForUpload({
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 2048,
        name: "variants.xlsx",
      }),
    ).toEqual({ ok: true });
  });

  it("từ chối loại / size sai", () => {
    expect(
      validateSpreadsheetFileForUpload({ type: "text/csv", size: 100, name: "a.csv" }).ok,
    ).toBe(false);
    expect(
      validateSpreadsheetFileForUpload({
        type: "application/vnd.ms-excel",
        size: MAX_UPLOAD_BYTES + 1,
        name: "a.xls",
      }).ok,
    ).toBe(false);
  });
});

describe("sniffSpreadsheetKind", () => {
  it("nhận ZIP .xlsx và OLE .xls", () => {
    expect(sniffSpreadsheetKind(Uint8Array.from([0x50, 0x4b, 3, 4, 0, 0, 0, 0]), "a.xlsx")).toBe(
      "xlsx",
    );
    expect(
      sniffSpreadsheetKind(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), "a.xls"),
    ).toBe("xls");
    expect(sniffSpreadsheetKind(Uint8Array.from([0x50, 0x4b, 3, 4, 0, 0, 0, 0]), "a.xls")).toBeNull();
  });
});

describe("parseOutboundMessageText", () => {
  it("cắt khoảng trắng và giới hạn độ dài", () => {
    expect(parseOutboundMessageText("  xin chào  ")).toEqual({ ok: true, value: "xin chào" });
    expect(parseOutboundMessageText("   ").ok).toBe(false);
    expect(parseOutboundMessageText("x".repeat(MESSAGE_TEXT_MAX + 1)).ok).toBe(false);
  });
});

describe("isMediaPlaceholderText", () => {
  it("nhận diện placeholder", () => {
    expect(isMediaPlaceholderText("[Video]")).toBe(true);
    expect(isMediaPlaceholderText("Xin chào")).toBe(false);
  });
});
