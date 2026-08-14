"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";
import { requireOwner } from "@/lib/auth";
import { safeInternalPath } from "@/lib/safe-path";
import { revalidatePath } from "next/cache";

export type AuthActionState = {
  error?: string;
  success?: string;
};

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = safeInternalPath(String(formData.get("next") ?? "/inbox"));

  if (!email || !password) {
    return { error: "Nhập email và mật khẩu." };
  }

  const staff = await prisma.staff.findUnique({ where: { email } });
  if (!staff) {
    return { error: "Email hoặc mật khẩu không đúng." };
  }

  const ok = await verifyPassword(password, staff.passwordHash);
  if (!ok) {
    return { error: "Email hoặc mật khẩu không đúng." };
  }

  await setSessionCookie({
    staffId: staff.id,
    shopId: staff.shopId,
    email: staff.email,
    name: staff.name,
    role: staff.role,
  });

  redirect(nextPath);
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function createStaffAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const session = await requireOwner();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "staff");
  const role = roleRaw === "owner" ? "owner" : "staff";

  if (!name || !email || !password) {
    return { error: "Điền đủ tên, email và mật khẩu." };
  }
  if (password.length < 8) {
    return { error: "Mật khẩu tối thiểu 8 ký tự." };
  }
  if (!email.includes("@")) {
    return { error: "Email không hợp lệ." };
  }

  const existing = await prisma.staff.findUnique({ where: { email } });
  if (existing) {
    return { error: "Email này đã được dùng." };
  }

  await prisma.staff.create({
    data: {
      id: `staff-${crypto.randomUUID()}`,
      shopId: session.shopId,
      name,
      email,
      passwordHash: await hashPassword(password),
      role,
    },
  });

  revalidatePath("/staff");
  return { success: `Đã thêm tài khoản ${email}.` };
}
