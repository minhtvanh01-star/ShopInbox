import { StaffManager } from "@/components/staff/StaffManager";
import { requireOwner } from "@/backend/auth";
import { formatTime } from "@/lib/labels";
import { prisma } from "@/backend/prisma";

export default async function StaffPage() {
  const session = await requireOwner();
  const members = await prisma.staff.findMany({
    where: { shopId: session.shopId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header">
        <h1 className="page-title">Nhân viên</h1>
        <p className="page-subtitle">
          Quản lý tài khoản đăng nhập. Mật khẩu được mã hóa trước khi lưu.
        </p>
      </header>
      <StaffManager
        members={members.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          createdAt: formatTime(member.createdAt.toISOString()),
        }))}
      />
    </div>
  );
}
