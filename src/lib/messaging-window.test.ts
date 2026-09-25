import { describe, expect, it } from "vitest";
import {
  getMessagingWindowInfo,
  latestCustomerMessageAt,
} from "./messaging-window";

describe("latestCustomerMessageAt", () => {
  it("lấy tin khách mới nhất", () => {
    expect(
      latestCustomerMessageAt([
        { sender: "shop", createdAt: "2026-09-15T10:00:00.000Z" },
        { sender: "customer", createdAt: "2026-09-15T08:00:00.000Z" },
        { sender: "customer", createdAt: "2026-09-15T09:00:00.000Z" },
      ]),
    ).toBe("2026-09-15T09:00:00.000Z");
  });

  it("không có tin khách → null", () => {
    expect(latestCustomerMessageAt([{ sender: "shop", createdAt: "2026-09-15T10:00:00.000Z" }])).toBeNull();
  });
});

describe("getMessagingWindowInfo", () => {
  const now = new Date("2026-09-15T12:00:00.000Z");

  it("trong 24h → open", () => {
    const info = getMessagingWindowInfo({
      channel: "facebook",
      lastCustomerMessageAt: "2026-09-15T01:00:00.000Z",
      now,
    });
    expect(info.kind).toBe("open");
    expect(info.banner).toBeNull();
  });

  it("FB 25h–7 ngày → human_agent", () => {
    const info = getMessagingWindowInfo({
      channel: "facebook",
      lastCustomerMessageAt: "2026-09-13T12:00:00.000Z",
      now,
    });
    expect(info.kind).toBe("human_agent");
    expect(info.banner).toMatch(/Human Agent/i);
  });

  it("IG quá 24h → closed (không HUMAN_AGENT)", () => {
    const info = getMessagingWindowInfo({
      channel: "instagram",
      lastCustomerMessageAt: "2026-09-13T12:00:00.000Z",
      now,
    });
    expect(info.kind).toBe("closed");
    expect(info.banner).toMatch(/Instagram/i);
  });

  it("web → local, không banner", () => {
    expect(getMessagingWindowInfo({ channel: "web", lastCustomerMessageAt: null, now }).kind).toBe(
      "local",
    );
  });

  it("Zalo trong 48h → open", () => {
    const info = getMessagingWindowInfo({
      channel: "zalo",
      lastCustomerMessageAt: "2026-09-14T00:00:00.000Z",
      now,
    });
    expect(info.kind).toBe("open");
    expect(info.banner).toBeNull();
  });

  it("Zalo 48h–7 ngày → cửa sổ OpenAPI", () => {
    const info = getMessagingWindowInfo({
      channel: "zalo",
      lastCustomerMessageAt: "2026-09-12T12:00:00.000Z",
      now,
    });
    expect(info.kind).toBe("human_agent");
    expect(info.banner).toMatch(/48 giờ|OpenAPI/i);
  });

  it("Zalo quá 7 ngày → closed", () => {
    const info = getMessagingWindowInfo({
      channel: "zalo",
      lastCustomerMessageAt: "2026-09-07T12:00:00.000Z",
      now,
    });
    expect(info.kind).toBe("closed");
    expect(info.banner).toMatch(/7 ngày/i);
  });
});
