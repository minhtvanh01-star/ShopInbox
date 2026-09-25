import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    order: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    orderItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/backend/prisma";
import { mergeNewOrdersForCustomer } from "@/backend/order-merge";

describe("mergeNewOrdersForCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({
        orderItem: {
          deleteMany: prisma.orderItem.deleteMany,
          createMany: prisma.orderItem.createMany,
        },
        order: {
          updateMany: prisma.order.updateMany,
        },
      } as never),
    );
  });

  it("từ chối khi < 2 đơn mới", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      {
        id: "o1",
        code: "DH-001",
        items: [{ productId: "p1", variantId: "v1", name: "Áo", price: 100, qty: 1 }],
      },
    ] as never);

    await expect(mergeNewOrdersForCustomer("shop1", "cust1")).rejects.toThrow(/2 đơn/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("gộp dòng trùng qty vào đơn cũ nhất và hủy đơn nguồn", async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      {
        id: "o-old",
        code: "DH-001",
        createdAt: new Date("2026-01-01"),
        items: [
          { productId: "p1", variantId: "v1", name: "Áo", price: 100_000, qty: 1 },
          { productId: null, variantId: null, name: "Phí ship", price: 20_000, qty: 1 },
        ],
      },
      {
        id: "o-new",
        code: "DH-002",
        createdAt: new Date("2026-01-02"),
        items: [{ productId: "p1", variantId: "v1", name: "Áo", price: 100_000, qty: 2 }],
      },
    ] as never);

    const result = await mergeNewOrdersForCustomer("shop1", "cust1");

    expect(result).toEqual({
      targetOrderId: "o-old",
      targetCode: "DH-001",
      cancelledCodes: ["DH-002"],
      lineCount: 2,
    });

    expect(prisma.orderItem.deleteMany).toHaveBeenCalledWith({ where: { orderId: "o-old" } });
    expect(prisma.orderItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          orderId: "o-old",
          productId: "p1",
          variantId: "v1",
          name: "Áo",
          price: 100_000,
          qty: 3,
        }),
        expect.objectContaining({
          orderId: "o-old",
          productId: null,
          variantId: null,
          name: "Phí ship",
          price: 20_000,
          qty: 1,
        }),
      ]),
    });
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["o-new"] }, shopId: "shop1" },
      data: { status: "cancelled" },
    });
  });
});
