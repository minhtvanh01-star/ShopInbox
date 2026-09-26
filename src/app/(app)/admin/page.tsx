import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/backend/super-admin";
import { SUPER_ADMIN_HOME } from "@/lib/super-admin";

export default async function AdminIndexPage() {
  await requireSuperAdmin();
  redirect(SUPER_ADMIN_HOME);
}
