import { describe, expect, it } from "vitest";
import {
  applyMessageReceipts,
  mergeReceiptOverlay,
  outboundReceiptState,
} from "./message-receipt";

describe("outboundReceiptState", () => {
  it("1 tick xám khi chưa đọc — kể cả đã delivered", () => {
    expect(outboundReceiptState({})).toBe("sent");
    expect(outboundReceiptState({ readAt: null })).toBe("sent");
    expect(outboundReceiptState({ readAt: undefined })).toBe("sent");
    expect(outboundReceiptState({ deliveredAt: "2026-08-17T01:59:00.000Z", readAt: null })).toBe(
      "sent",
    );
  });

  it("2 tick xanh chỉ khi có readAt (khách mở chat)", () => {
    expect(outboundReceiptState({ readAt: "2026-08-17T02:00:00.000Z" })).toBe("read");
  });
});

describe("applyMessageReceipts", () => {
  it("gắn readAt từ overlay mà không xóa receipt cũ", () => {
    const messages = [
      { id: "m1", readAt: null as string | null, deliveredAt: null as string | null },
      { id: "m2", readAt: "2026-08-17T01:00:00.000Z", deliveredAt: null as string | null },
    ];
    const next = applyMessageReceipts(messages, {
      m1: { readAt: "2026-08-17T02:00:00.000Z", deliveredAt: "2026-08-17T01:59:00.000Z" },
      m2: { readAt: null, deliveredAt: null },
    });
    expect(next[0]).toMatchObject({
      id: "m1",
      readAt: "2026-08-17T02:00:00.000Z",
      deliveredAt: "2026-08-17T01:59:00.000Z",
    });
    expect(next[1]?.readAt).toBe("2026-08-17T01:00:00.000Z");
  });
});

describe("mergeReceiptOverlay", () => {
  it("không downgrade readAt đã có", () => {
    const prev = { m1: { readAt: "2026-08-17T02:00:00.000Z", deliveredAt: null } };
    expect(mergeReceiptOverlay(prev, [{ id: "m1", readAt: null, deliveredAt: null }])).toBe(prev);
  });

  it("ghi overlay khi poll thấy readAt mới", () => {
    const next = mergeReceiptOverlay({}, [
      { id: "m1", readAt: "2026-08-17T02:00:00.000Z", deliveredAt: null },
    ]);
    expect(next.m1).toEqual({
      readAt: "2026-08-17T02:00:00.000Z",
      deliveredAt: null,
    });
  });
});
