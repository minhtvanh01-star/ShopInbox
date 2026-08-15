import { StaffManager } from "@/components/staff/StaffManager";
import { hasPermission, requirePermission } from "@/backend/rbac";
import { formatTime } from "@/lib/labels";
import { prisma } from "@/backend/prisma";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";

export default async function StaffPage() {
  const session = await requirePermission(PERMISSION_CODES.staffRead);
  const canManage = await hasPermission(session, PERMISSION_CODES.staffManage);

  const [members, roles] = await Promise.all([
    prisma.staff.findMany({
      where: { shopId: session.shopId },
      include: { role: true },
      orderBy: [{ isActive: "asc" }, { createdAt: "desc" }],
    }),
    prisma.role.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header bg-[linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)]">
        <h1 className="page-title">Nhân viên</h1>
        <p className="page-subtitle">
          Phê duyệt tài khoản đăng ký mới / Google, gán vai trò và bật/tắt đăng nhập. Mật khẩu lưu
          dạng hash.
        </p>
      </header>
      <StaffManager
        canManage={canManage}
        roles={roles.map((role) => ({ code: role.code, name: role.name }))}
        members={members.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.roleCode,
          roleName: member.role.name,
          isActive: member.isActive,
          createdAt: formatTime(member.createdAt.toISOString()),
        }))}
      />
    </div>
  );
}
