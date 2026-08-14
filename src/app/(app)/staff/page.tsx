import { StaffManager } from "@/components/StaffManager";
import { requireOwner } from "@/lib/auth";
import { formatTime } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export default async function StaffPage() {
  const session = await requireOwner();
  const members = await prisma.staff.findMany({
    where: { shopId: session.shopId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Nhân viên</h1>
        <p className="text-sm text-slate-500">
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
