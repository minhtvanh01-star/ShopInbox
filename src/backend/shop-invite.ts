import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "@/backend/prisma";
import { getPublicAppUrl } from "@/backend/oauth-config";
import { hashPassword } from "@/backend/password";
import { assertShopHasActiveSeat } from "@/backend/shop-seats";
import { EMAIL_RE, REGISTER_MIN_PASSWORD_LENGTH, REGISTER_NAME_MAX } from "@/lib/auth-password";
import { DEFAULT_ROLE_CODE, normalizeRoleCode, ROLE_CODES } from "@/lib/rbac-catalog";
import {
  inviteEmailMatches,
  invitePath,
  isInviteTokenShape,
  isInviteUsable,
  SHOP_INVITE_TTL_MS,
} from "@/lib/shop-invite";

function inviteHmacKey() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Thiếu SESSION_SECRET để hash lời mời.");
    }
    return "shopinbox-invite-dev-key";
  }
  return secret;
}

export function hashShopInviteToken(token: string) {
  return createHmac("sha256", inviteHmacKey()).update(token.trim()).digest("hex");
}

export function createShopInviteToken() {
  return randomBytes(24).toString("base64url");
}

export function shopInviteUrl(token: string) {
  return `${getPublicAppUrl()}${invitePath(token)}`;
}

const INVITE_ROLES = new Set<string>([ROLE_CODES.staff, ROLE_CODES.manager, ROLE_CODES.admin]);

export function normalizeInviteRole(raw: string | null | undefined) {
  const role = normalizeRoleCode(raw ?? DEFAULT_ROLE_CODE);
  return INVITE_ROLES.has(role) ? role : DEFAULT_ROLE_CODE;
}

export async function createShopInvite(input: {
  shopId: string;
  createdByStaffId: string;
  roleCode?: string;
  email?: string;
  ttlMs?: number;
}) {
  const email = input.email?.trim().toLowerCase() || null;
  if (email && !EMAIL_RE.test(email)) {
    return { ok: false as const, error: "Email không hợp lệ." };
  }

  const roleCode = normalizeInviteRole(input.roleCode);
  const role = await prisma.role.findFirst({ where: { code: roleCode, isActive: true } });
  if (!role) {
    return { ok: false as const, error: "Vai trò không hợp lệ hoặc đã tắt." };
  }

  if (email) {
    const existing = await prisma.staff.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return { ok: false as const, error: "Email này đã có tài khoản." };
    }
  }

  const token = createShopInviteToken();
  const invite = await prisma.shopInvite.create({
    data: {
      id: `invite-${crypto.randomUUID()}`,
      shopId: input.shopId,
      tokenHash: hashShopInviteToken(token),
      email,
      roleCode: role.code,
      expiresAt: new Date(Date.now() + (input.ttlMs ?? SHOP_INVITE_TTL_MS)),
      createdByStaffId: input.createdByStaffId,
    },
  });

  return {
    ok: true as const,
    invite,
    token,
    url: shopInviteUrl(token),
  };
}

export async function listOpenShopInvites(shopId: string) {
  return prisma.shopInvite.findMany({
    where: {
      shopId,
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      roleCode: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

export async function revokeShopInvite(shopId: string, inviteId: string) {
  const invite = await prisma.shopInvite.findFirst({
    where: { id: inviteId, shopId },
  });
  if (!invite || invite.usedAt || invite.revokedAt) {
    return { ok: false as const, error: "Không tìm thấy lời mời còn hiệu lực." };
  }
  await prisma.shopInvite.update({
    where: { id: invite.id },
    data: { revokedAt: new Date() },
  });
  return { ok: true as const };
}

export async function loadUsableInviteByToken(token: string) {
  if (!isInviteTokenShape(token)) return null;
  const invite = await prisma.shopInvite.findUnique({
    where: { tokenHash: hashShopInviteToken(token) },
    include: { shop: { select: { id: true, name: true, setupCompletedAt: true } } },
  });
  if (!invite || !isInviteUsable(invite)) return null;
  return invite;
}

export async function acceptShopInvite(input: {
  token: string;
  name: string;
  email: string;
  password: string;
}) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!name) return { ok: false as const, error: "Họ tên không được để trống." };
  if (name.length > REGISTER_NAME_MAX) {
    return { ok: false as const, error: `Họ tên tối đa ${REGISTER_NAME_MAX} ký tự.` };
  }
  if (!EMAIL_RE.test(email)) return { ok: false as const, error: "Email không hợp lệ." };
  if (password.length < REGISTER_MIN_PASSWORD_LENGTH) {
    return { ok: false as const, error: `Mật khẩu tối thiểu ${REGISTER_MIN_PASSWORD_LENGTH} ký tự.` };
  }

  const invite = await loadUsableInviteByToken(input.token);
  if (!invite) {
    return { ok: false as const, error: "Lời mời không hợp lệ hoặc đã hết hạn." };
  }
  if (!inviteEmailMatches(invite.email, email)) {
    return { ok: false as const, error: "Email không khớp lời mời." };
  }
  if (!invite.shop.setupCompletedAt) {
    return { ok: false as const, error: "Chủ shop chưa hoàn tất cấu hình cửa hàng." };
  }

  const existing = await prisma.staff.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { ok: false as const, error: "Email này đã được đăng ký." };
  }

  const seatError = await assertShopHasActiveSeat(invite.shopId);
  if (seatError) {
    return { ok: false as const, error: seatError };
  }

  try {
    const staff = await prisma.$transaction(async (tx) => {
      const fresh = await tx.shopInvite.findUnique({ where: { id: invite.id } });
      if (!fresh || !isInviteUsable(fresh)) {
        throw new Error("invite_gone");
      }
      const created = await tx.staff.create({
        data: {
          id: `staff-${crypto.randomUUID()}`,
          shopId: invite.shopId,
          name,
          email,
          passwordHash: await hashPassword(password),
          roleCode: normalizeRoleCode(invite.roleCode),
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          shopId: true,
          roleCode: true,
          isActive: true,
        },
      });
      await tx.shopInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
      return created;
    });
    return { ok: true as const, staff };
  } catch (error) {
    if (error instanceof Error && error.message === "invite_gone") {
      return { ok: false as const, error: "Lời mời không hợp lệ hoặc đã hết hạn." };
    }
    return { ok: false as const, error: "Email này đã được đăng ký." };
  }
}
