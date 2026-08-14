"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/backend/prisma";
import { verifyPassword } from "@/backend/password";
import { clearSessionCookie, setSessionCookie } from "@/backend/session";
import { safeInternalPath } from "@/backend/safe-path";

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
