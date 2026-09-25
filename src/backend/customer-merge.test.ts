import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    customer: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    customerIdentity: {
      delete: vi.fn(),
      update: vi.fn(),
    },
    conversation: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    message: {
      updateMany: vi.fn(),
    },
    order: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/backend/prisma";
import { mergeCustomers } from "@/backend/customer-merge";

describe("mergeCustomers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.conversation.findMany).mockResolvedValue([]);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn({
        customerIdentity: {
          delete: prisma.customerIdentity.delete,
          update: prisma.customerIdentity.update,
        },
        conversation: {
          findMany: prisma.conversation.findMany,
          update: prisma.conversation.update,
          updateMany: prisma.conversation.updateMany,
          delete: prisma.conversation.delete,
        },
        message: { updateMany: prisma.message.updateMany },
        order: { updateMany: prisma.order.updateMany },
        customer: {
          update: prisma.customer.update,
          delete: prisma.customer.delete,
        },
      } as never),
    );
  });

  it("từ chối khi keep === absorb", async () => {
    await expect(mergeCustomers("shop1", "c1", "c1")).rejects.toThrow(/khác nhau/);
  });

  it("từ chối khi thiếu khách", async () => {
    vi.mocked(prisma.customer.findFirst)
      .mockResolvedValueOnce({ id: "keep", identities: [] } as never)
      .mockResolvedValueOnce(null);

    await expect(mergeCustomers("shop1", "keep", "gone")).rejects.toThrow(/Không tìm thấy/);
  });

  it("từ chối khi cùng kênh nhưng PSID khác nhau", async () => {
    vi.mocked(prisma.customer.findFirst)
      .mockResolvedValueOnce({
        id: "keep",
        identities: [{ id: "id-fb", channel: "facebook", externalId: "psid-a" }],
      } as never)
      .mockResolvedValueOnce({
        id: "absorb",
        identities: [{ id: "id-fb-2", channel: "facebook", externalId: "psid-b" }],
      } as never);

    await expect(mergeCustomers("shop1", "keep", "absorb")).rejects.toThrow(/ID khác nhau/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("chuyển identity kênh khác; xóa identity trùng cùng PSID; gộp hồ sơ", async () => {
    vi.mocked(prisma.customer.findFirst)
      .mockResolvedValueOnce({
        id: "keep",
        name: "Minh",
        phone: "0901",
        email: null,
        address: null,
        note: "VIP",
        avatarUrl: null,
        identities: [{ id: "id-fb", channel: "facebook", externalId: "psid-1" }],
      } as never)
      .mockResolvedValueOnce({
        id: "absorb",
        name: "Minh IG",
        phone: "0902",
        email: "a@b.c",
        address: "HN",
        note: "size M",
        avatarUrl: "https://img",
        identities: [
          { id: "id-fb-dup", channel: "facebook", externalId: "psid-1" },
          { id: "id-ig", channel: "instagram", externalId: "ig-1" },
        ],
      } as never);

    const result = await mergeCustomers("shop1", "keep", "absorb");

    expect(result).toEqual({ keepId: "keep", absorbId: "absorb", keepName: "Minh" });
    expect(prisma.customerIdentity.delete).toHaveBeenCalledWith({ where: { id: "id-fb-dup" } });
    expect(prisma.customerIdentity.update).toHaveBeenCalledWith({
      where: { id: "id-ig" },
      data: { customerId: "keep" },
    });
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { customerId: "absorb", shopId: "shop1" },
      data: { customerId: "keep" },
    });
    expect(prisma.customer.delete).toHaveBeenCalledWith({ where: { id: "absorb" } });
  });
});
