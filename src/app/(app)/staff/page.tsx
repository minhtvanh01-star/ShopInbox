import { StaffInvitePanel } from "@/components/staff/StaffInvitePanel";
import { StaffManager } from "@/components/staff/StaffManager";
import { hasPermission, requirePermission } from "@/backend/rbac";
import { getShopPolicy } from "@/backend/shop-policy";
import { listOpenShopInvites } from "@/backend/shop-invite";
import { formatDateTime, formatTime } from "@/lib/labels";
import { prisma } from "@/backend/prisma";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";

export default async function StaffPage() {
  const session = await requirePermission(PERMISSION_CODES.staffRead);
  const canManage = await hasPermission(session, PERMISSION_CODES.staffManage);

  const [members, roles, policy, invites] = await Promise.all([
    prisma.staff.findMany({
      where: { shopId: session.shopId },
      include: { role: true },
      orderBy: [{ isActive: "asc" }, { createdAt: "desc" }],
    }),
    prisma.role.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    getShopPolicy(session.shopId),
    canManage ? listOpenShopInvites(session.shopId) : Promise.resolve([]),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header bg-[linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)]">
        <h1 className="page-title">Nhân viên</h1>
        <p className="page-subtitle">
          Mời nhân viên vào đúng shop này, hoặc tạo tài khoản trực tiếp. Gán vai trò và bật/tắt
          đăng nhập.
        </p>
      </header>
      {canManage ? (
        <div className="px-6 pt-6">
          <StaffInvitePanel
            roles={roles.map((role) => ({ code: role.code, name: role.name }))}
            invites={invites.map((invite) => ({
              id: invite.id,
              email: invite.email,
              roleCode: invite.roleCode,
              expiresAt: formatDateTime(invite.expiresAt.toISOString()),
            }))}
          />
        </div>
      ) : null}
      <StaffManager
        canManage={canManage}
        maxUsersPerShop={policy.maxUsersPerShop}
        roles={roles.map((role) => ({ code: role.code, name: role.name }))}
        members={members.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          avatarUrl: member.avatarUrl,
          role: member.roleCode,
          roleName: member.role.name,
          isActive: member.isActive,
          createdAt: formatTime(member.createdAt.toISOString()),
        }))}
      />
    </div>
  );
}
