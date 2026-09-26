import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    shop: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/backend/prisma";
import { getPlatformShopDetail, listPlatformShops } from "@/backend/platform-shops";

const missingPlan = new Error(
  "P2022\nThe column `shops.planCode` does not exist in the current database.",
);

describe("listPlatformShops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries without plan/support when shop-ops columns are missing", async () => {
    vi.mocked(prisma.shop.findMany)
      .mockRejectedValueOnce(missingPlan)
      .mockResolvedValueOnce([
        {
          id: "shop1",
          name: "Lily",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          setupCompletedAt: new Date("2026-01-02T00:00:00.000Z"),
          suspendedAt: null,
          _count: { staff: 2, channelAccounts: 1, orders: 4 },
          staff: [{ id: "s1", name: "Minh", email: "admin@lily.vn" }],
        },
      ] as never);

    const shops = await listPlatformShops();
    expect(shops).toHaveLength(1);
    expect(shops[0]?.planCode).toBe("trial");
    expect(shops[0]?.supportStatus).toBe("ok");
    expect(shops[0]?.name).toBe("Lily");
    expect(prisma.shop.findMany).toHaveBeenCalledTimes(2);
  });

  it("returns an empty list instead of throwing when every query fails", async () => {
    vi.mocked(prisma.shop.findMany).mockRejectedValue(new Error("db down"));
    await expect(listPlatformShops()).resolves.toEqual([]);
  });
});

describe("getPlatformShopDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fills default plan/support when shop-ops columns are missing", async () => {
    vi.mocked(prisma.shop.findUnique)
      .mockRejectedValueOnce(missingPlan)
      .mockResolvedValueOnce({
        id: "shop1",
        name: "Lily",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        setupCompletedAt: new Date("2026-01-02T00:00:00.000Z"),
        suspendedAt: null,
        staff: [
          {
            id: "s1",
            name: "Minh",
            email: "admin@lily.vn",
            roleCode: "admin",
            isActive: true,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ],
        channelAccounts: [],
        _count: { customers: 0, orders: 0, conversations: 0 },
      } as never);

    const shop = await getPlatformShopDetail("shop1");
    expect(shop?.planCode).toBe("trial");
    expect(shop?.supportStatus).toBe("ok");
    expect(shop?.staff[0]?.isSuperAdmin).toBe(false);
    expect(shop?.staff[0]?.avatarUrl).toBeNull();
  });
});
