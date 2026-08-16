import { describe, expect, it } from "vitest";
import {
  chatDayKey,
  mergeConversationThread,
  pruneSyncedOutbound,
  type LocalOutboundMessage,
} from "./inbox-thread";
import type { Message } from "./types";

function msg(partial: Partial<Message> & Pick<Message, "id" | "text" | "createdAt">): Message {
  return {
    conversationId: "c1",
    sender: "shop",
    reactions: [],
    ...partial,
  };
}

describe("chatDayKey", () => {
  it("uses Vietnam calendar day", () => {
    expect(chatDayKey("2026-08-14T17:00:00.000Z")).toBe("2026-08-15");
  });
});

describe("mergeConversationThread", () => {
  it("keeps two identical quick-replies when only one server twin exists", () => {
    const createdAt = "2026-08-15T10:01:00.000Z";
    const server = [msg({ id: "s1", text: "Còn hàng", createdAt })];
    const local: LocalOutboundMessage[] = [
      {
        ...msg({ id: "temp-1", text: "Còn hàng", createdAt }),
        localStatus: "sending",
      },
      {
        ...msg({
          id: "temp-2",
          text: "Còn hàng",
          createdAt: "2026-08-15T10:01:05.000Z",
        }),
        localStatus: "sending",
      },
    ];
    const thread = mergeConversationThread(server, local, "c1");
    expect(thread.map((item) => item.id).sort()).toEqual(["s1", "temp-2"].sort());
  });

  it("drops failed local when server already has the twin (success race)", () => {
    const createdAt = "2026-08-15T10:01:00.000Z";
    const server = [msg({ id: "s1", text: "xin chào", createdAt })];
    const local: LocalOutboundMessage[] = [
      {
        ...msg({ id: "temp-1", text: "xin chào", createdAt }),
        localStatus: "failed",
      },
    ];
    expect(pruneSyncedOutbound(local, server)).toEqual([]);
  });

  it("does not pair two different images by generic [Ảnh] alone when names differ", () => {
    const createdAt = "2026-08-15T10:01:00.000Z";
    const server = [
      msg({
        id: "s1",
        text: "[Ảnh]",
        createdAt,
        attachmentType: "image",
        attachmentUrl: "/a.jpg",
        attachmentName: "a.jpg",
      }),
    ];
    const local: LocalOutboundMessage[] = [
      {
        ...msg({
          id: "temp-1",
          text: "[Ảnh]",
          createdAt,
          attachmentType: "image",
          attachmentUrl: "blob:1",
          attachmentName: "b.jpg",
        }),
        localStatus: "sending",
      },
    ];
    const thread = mergeConversationThread(server, local, "c1");
    expect(thread.map((item) => item.id).sort()).toEqual(["s1", "temp-1"].sort());
  });
});
