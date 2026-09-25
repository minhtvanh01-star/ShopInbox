import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/backend/prisma", () => ({
  prisma: {
    staff: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/backend/session", () => ({
  getSession: vi.fn(),
}));

import { prisma } from "@/backend/prisma";
import { getSession } from "@/backend/session";
import {
  hasPermission,
  hasPermissionCodes,
  invalidatePermissionCache,
  requireActionPermission,
  requirePermission,
  requirePermissionApi,
} from "@/backend/rbac";
import {
  PERMISSION_CODES,
  ROLE_CODES,
  catalogHasPermission,
  normalizeRoleCode,
} from "@/lib/rbac-catalog";

const adminSession = {
  staffId: "staff1",
  shopId: "shop1",
  email: "admin@lily.vn",
  name: "Minh",
  role: "admin",
  lastActiveAt: Date.now(),
};

const staffSession = {
  staffId: "staff2",
  shopId: "shop1",
  email: "nhanvien@lily.vn",
  name: "Lan",
  role: "staff",
  lastActiveAt: Date.now(),
};

function mockStaffPerms(shopId: string, codes: string[]) {
  vi.mocked(prisma.staff.findUnique).mockResolvedValue({
    shopId,
    isActive: true,
    role: {
      isActive: true,
      permissions: codes.map((permissionCode) => ({ permissionCode })),
    },
  } as never);
}

describe("rbac catalog", () => {
  it("maps owner alias to admin", () => {
    expect(normalizeRoleCode("owner")).toBe(ROLE_CODES.admin);
    expect(normalizeRoleCode("admin")).toBe(ROLE_CODES.admin);
  });

  it("staff catalog does not include channels.connect", () => {
    expect(catalogHasPermission(ROLE_CODES.staff, PERMISSION_CODES.channelsConnect)).toBe(false);
    expect(catalogHasPermission(ROLE_CODES.admin, PERMISSION_CODES.channelsConnect)).toBe(true);
    expect(catalogHasPermission(ROLE_CODES.manager, PERMISSION_CODES.auditRead)).toBe(true);
    expect(catalogHasPermission(ROLE_CODES.manager, PERMISSION_CODES.staffManage)).toBe(false);
    expect(catalogHasPermission(ROLE_CODES.staff, PERMISSION_CODES.customersUpdate)).toBe(true);
    expect(catalogHasPermission(ROLE_CODES.staff, PERMISSION_CODES.productsManage)).toBe(false);
    expect(catalogHasPermission(ROLE_CODES.manager, PERMISSION_CODES.productsManage)).toBe(true);
  });

  it("hasPermissionCodes checks membership", () => {
    expect(hasPermissionCodes(["inbox.read"], "inbox.read")).toBe(true);
    expect(hasPermissionCodes(["inbox.read"], PERMISSION_CODES.channelsConnect)).toBe(false);
  });
});

describe("hasPermission / requirePermission", () => {
  beforeEach(() => {
    invalidatePermissionCache();
    vi.clearAllMocks();
  });

  it("loads permissions from DB for the session staff", async () => {
    mockStaffPerms("shop1", [PERMISSION_CODES.inboxRead, PERMISSION_CODES.inboxReply]);

    expect(await hasPermission(staffSession, PERMISSION_CODES.inboxRead)).toBe(true);
    expect(await hasPermission(staffSession, PERMISSION_CODES.channelsConnect)).toBe(false);
  });

  it("denies when shopId does not match", async () => {
    mockStaffPerms("other-shop", [PERMISSION_CODES.channelsConnect]);
    expect(await hasPermission(adminSession, PERMISSION_CODES.channelsConnect)).toBe(false);
  });

  it("requirePermission denies staff for channels.connect", async () => {
    mockStaffPerms("shop1", [
      PERMISSION_CODES.inboxRead,
      PERMISSION_CODES.inboxReply,
      PERMISSION_CODES.ordersRead,
    ]);
    vi.mocked(getSession).mockResolvedValue(staffSession);

    await expect(requirePermission(PERMISSION_CODES.channelsConnect)).rejects.toThrow(
      "REDIRECT:/settings/profile",
    );
  });

  it("requireActionPermission throws instead of redirect", async () => {
    mockStaffPerms("shop1", [PERMISSION_CODES.inboxRead]);
    vi.mocked(getSession).mockResolvedValue(staffSession);

    await expect(requireActionPermission(PERMISSION_CODES.channelsConnect)).rejects.toThrow(
      "Bạn không có quyền thực hiện thao tác này.",
    );
  });

  it("requirePermissionApi returns null when staff lacks channels.connect", async () => {
    mockStaffPerms("shop1", [PERMISSION_CODES.inboxRead]);
    vi.mocked(getSession).mockResolvedValue(staffSession);

    expect(await requirePermissionApi(PERMISSION_CODES.channelsConnect)).toBeNull();
  });

  it("requirePermission allows admin with channels.connect", async () => {
    mockStaffPerms("shop1", [PERMISSION_CODES.channelsConnect]);
    vi.mocked(getSession).mockResolvedValue(adminSession);

    await expect(requirePermission(PERMISSION_CODES.channelsConnect)).resolves.toEqual(adminSession);
  });

  it("denies permissions when staff is inactive", async () => {
    vi.mocked(prisma.staff.findUnique).mockResolvedValue({
      shopId: "shop1",
      isActive: false,
      role: {
        isActive: true,
        permissions: [{ permissionCode: PERMISSION_CODES.channelsConnect }],
      },
    } as never);

    expect(await hasPermission(adminSession, PERMISSION_CODES.channelsConnect)).toBe(false);
  });
});

describe("isAdminSession", () => {
  it("detects admin and owner alias", async () => {
    const { isAdminSession } = await import("@/backend/rbac");
    expect(isAdminSession({ role: "admin" })).toBe(true);
    expect(isAdminSession({ role: "owner" })).toBe(true);
    expect(isAdminSession({ role: "Admin" })).toBe(true);
    expect(isAdminSession({ role: "staff" })).toBe(false);
  });
});

describe("isAdminRole / normalizeRoleCode casing", () => {
  it("treats Admin/owner casing as admin", async () => {
    const { isAdminRole, normalizeRoleCode } = await import("@/lib/rbac-catalog");
    expect(normalizeRoleCode(" Admin ")).toBe(ROLE_CODES.admin);
    expect(normalizeRoleCode("OWNER")).toBe(ROLE_CODES.admin);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("Admin")).toBe(true);
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("staff")).toBe(false);
  });
});
