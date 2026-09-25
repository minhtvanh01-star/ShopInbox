import { describe, expect, it } from "vitest";
import { isInboxChannelVisible, visibleInboxChannels } from "./inbox-visibility";

describe("isInboxChannelVisible", () => {
  it("chỉ hiện kênh ready", () => {
    expect(isInboxChannelVisible("ready")).toBe(true);
    expect(isInboxChannelVisible("disconnected")).toBe(false);
    expect(isInboxChannelVisible("connecting")).toBe(false);
  });
});

describe("visibleInboxChannels", () => {
  it("ẩn kênh đã ngắt, giữ kênh còn nối", () => {
    expect(
      visibleInboxChannels([
        { channel: "facebook", status: "disconnected" },
        { channel: "web", status: "ready" },
        { channel: "zalo", status: "connecting" },
      ]),
    ).toEqual(["web"]);
  });

  it("không còn kênh nào nối → danh sách rỗng", () => {
    expect(
      visibleInboxChannels([{ channel: "facebook", status: "disconnected" }]),
    ).toEqual([]);
  });
});
