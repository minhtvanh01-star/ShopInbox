import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterProfileForm } from "@/components/auth/RegisterProfileForm";
import { requireSession } from "@/backend/auth";
import { prisma } from "@/backend/prisma";
import { SHOP_SETUP_PATH } from "@/lib/shop-setup";
import { redirect } from "next/navigation";

export default async function RegisterProfilePage() {
  const session = await requireSession();
  let staff: { name: string; email: string; phone: string | null; avatarUrl: string | null } | null;
  try {
    staff = await prisma.staff.findUnique({
      where: { id: session.staffId },
      select: { name: true, email: true, phone: true, avatarUrl: true },
    });
  } catch {
    const basic = await prisma.staff.findUnique({
      where: { id: session.staffId },
      select: { name: true, email: true },
    });
    staff = basic ? { ...basic, phone: null, avatarUrl: null } : null;
  }
  if (!staff) {
    redirect("/login");
  }

  if (staff.phone?.trim() && session.shopSetupComplete === false) {
    redirect(SHOP_SETUP_PATH);
  }
  if (staff.phone?.trim() && session.shopSetupComplete !== false) {
    redirect("/settings/profile");
  }

  return (
    <AuthShell
      title="Thông tin cá nhân"
      subtitle="Bước 1 — hồ sơ chủ shop"
      intro="Họ tên và số điện thoại."
    >
      <RegisterProfileForm
        email={staff.email}
        defaultName={staff.name}
        defaultPhone={staff.phone ?? ""}
        avatarUrl={staff.avatarUrl}
      />
    </AuthShell>
  );
}
