import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/backend/prisma";
import { abandonIncompleteShopRegistration } from "./abandon-shop-registration";

const session = {
  staffId: "staff-1",
  shopId: "shop-1",
  email: "user@gmail.com",
  name: "Lan",
  role: "admin",
  lastActiveAt: Date.now(),
  shopSetupComplete: false,
  isSuperAdmin: false,
};

function mockTx(shop: unknown) {
  const tx = {
    $executeRaw: vi.fn(),
    shop: {
      findUnique: vi.fn().mockResolvedValue(shop),
      delete: vi.fn().mockResolvedValue({}),
    },
    shopInvite: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
    (fn as unknown as (client: typeof tx) => Promise<unknown>)(tx),
  );
  return tx;
}

describe("abandonIncompleteShopRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("xóa shop chưa setup khi đúng 1 chủ", async () => {
    const tx = mockTx({
      id: "shop-1",
      setupCompletedAt: null,
      staff: [{ id: "staff-1" }],
      _count: { channelAccounts: 0 },
    });

    await expect(abandonIncompleteShopRegistration(session)).resolves.toEqual({
      ok: true,
      shopId: "shop-1",
    });
    expect(tx.shopInvite.deleteMany).toHaveBeenCalledWith({ where: { shopId: "shop-1" } });
    expect(tx.shop.delete).toHaveBeenCalledWith({ where: { id: "shop-1" } });
  });

  it("không xóa khi shop đã cấu hình xong", async () => {
    const tx = mockTx({
      id: "shop-1",
      setupCompletedAt: new Date("2026-09-28T01:00:00.000Z"),
      staff: [{ id: "staff-1" }],
      _count: { channelAccounts: 0 },
    });

    await expect(abandonIncompleteShopRegistration(session)).resolves.toMatchObject({
      ok: false,
    });
    expect(tx.shop.delete).not.toHaveBeenCalled();
  });
});
