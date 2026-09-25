import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    orderChecklistTemplate: {
      findMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
    },
    orderChecklistCheck: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/backend/prisma";
import {
  attachChecklistToOrder,
  ensureChecklistOnOrder,
  ensureDefaultChecklistTemplates,
  setOrderChecklistDone,
} from "@/backend/order-checklist";

describe("order-checklist backend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ensureDefaultChecklistTemplates seed khi shop chưa có mục", async () => {
    vi.mocked(prisma.orderChecklistTemplate.count).mockResolvedValue(0);
    vi.mocked(prisma.orderChecklistTemplate.createMany).mockResolvedValue({ count: 5 });
    vi.mocked(prisma.orderChecklistTemplate.findMany).mockResolvedValue([
      { id: "t1", label: "Xác nhận SĐT với khách" },
    ] as never);

    const rows = await ensureDefaultChecklistTemplates("shop1");
    expect(prisma.orderChecklistTemplate.createMany).toHaveBeenCalled();
    expect(rows).toHaveLength(1);
  });

  it("attachChecklistToOrder tạo check chưa tick", async () => {
    vi.mocked(prisma.orderChecklistTemplate.count).mockResolvedValue(1);
    vi.mocked(prisma.orderChecklistTemplate.findMany).mockResolvedValue([
      { id: "t1", label: "A", sortOrder: 0, enabled: true },
    ] as never);
    vi.mocked(prisma.orderChecklistCheck.createMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.orderChecklistCheck.findMany).mockResolvedValue([
      { id: "c1", done: false, templateId: "t1", template: { label: "A", sortOrder: 0 } },
    ] as never);

    const checks = await attachChecklistToOrder("shop1", "o1");
    expect(prisma.orderChecklistCheck.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ orderId: "o1", templateId: "t1", done: false })],
      }),
    );
    expect(checks).toHaveLength(1);
  });

  it("setOrderChecklistDone cập nhật done + staff", async () => {
    vi.mocked(prisma.orderChecklistCheck.findFirst).mockResolvedValue({
      id: "c1",
      done: false,
      template: { label: "Đã ship" },
      order: { code: "DH-001" },
    } as never);
    vi.mocked(prisma.orderChecklistCheck.update).mockResolvedValue({
      id: "c1",
      done: true,
      template: { label: "Đã ship" },
    } as never);

    const result = await setOrderChecklistDone({
      shopId: "shop1",
      orderId: "o1",
      checkId: "c1",
      done: true,
      staffId: "s1",
    });

    expect(result.to).toBe(true);
    expect(result.label).toBe("Đã ship");
    expect(prisma.orderChecklistCheck.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ done: true, doneByStaffId: "s1" }),
      }),
    );
  });

  it("ensureChecklistOnOrder bỏ qua nếu đã có check", async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({ id: "o1" } as never);
    vi.mocked(prisma.orderChecklistCheck.count).mockResolvedValue(2);
    vi.mocked(prisma.orderChecklistCheck.findMany).mockResolvedValue([
      { id: "c1", template: { label: "A", sortOrder: 0 } },
      { id: "c2", template: { label: "B", sortOrder: 1 } },
    ] as never);

    const rows = await ensureChecklistOnOrder("shop1", "o1");
    expect(rows).toHaveLength(2);
    expect(prisma.orderChecklistCheck.createMany).not.toHaveBeenCalled();
  });
});
