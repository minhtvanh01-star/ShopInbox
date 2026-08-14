import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: () => null,
  })),
}));

import { prisma } from "@/backend/prisma";
import { sanitizeAuditMetadata, writeAudit } from "@/backend/audit";
import { AUDIT_ACTIONS } from "@/lib/rbac-catalog";

describe("sanitizeAuditMetadata", () => {
  it("strips secret keys", () => {
    expect(
      sanitizeAuditMetadata({
        password: "Admin@123",
        accessToken: "tok",
        appSecret: "s",
        orderId: "o1",
      }),
    ).toEqual({ orderId: "o1" });
  });
});

describe("writeAudit", () => {
  beforeEach(() => {
    vi.mocked(prisma.auditLog.create).mockReset();
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "a1" } as never);
  });

  it("inserts a row from session actor", async () => {
    await writeAudit({
      actor: {
        staffId: "staff1",
        shopId: "shop1",
        email: "admin@lily.vn",
        name: "Minh",
        role: "admin",
      },
      action: AUDIT_ACTIONS.authLogin,
      entityType: "Session",
      entityId: "staff1",
      metadata: { method: "password" },
      ip: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        shopId: "shop1",
        actorId: "staff1",
        actorEmail: "admin@lily.vn",
        actorRole: "admin",
        action: AUDIT_ACTIONS.authLogin,
        entityType: "Session",
        entityId: "staff1",
        metadata: { method: "password" },
        ip: "127.0.0.1",
        userAgent: "vitest",
      }),
    });
  });

  it("fail-soft when insert throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error("db down"));

    await expect(
      writeAudit({
        action: AUDIT_ACTIONS.authLogin,
        ip: "1.1.1.1",
        userAgent: "test",
      }),
    ).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
