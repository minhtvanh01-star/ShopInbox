import { describe, expect, it } from "vitest";
import { pickOwnedChannelAccount } from "@/backend/channel-account-pick";

describe("pickOwnedChannelAccount", () => {
  it("returns the only shop row", () => {
    const row = { shopId: "shop1", connectedAt: new Date("2026-01-01") };
    expect(pickOwnedChannelAccount([row])).toEqual(row);
  });

  it("fails closed when two shops share a page", () => {
    expect(
      pickOwnedChannelAccount([
        { shopId: "shop1", connectedAt: new Date("2026-02-01") },
        { shopId: "shop2", connectedAt: new Date("2026-03-01") },
      ]),
    ).toBeNull();
  });
});
