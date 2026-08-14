"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/backend/auth";
import { hashPassword } from "@/backend/password";
import { prisma } from "@/backend/prisma";

export type StaffActionState = {
  error?: string;
  success?: string;
};

export async function createStaffAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
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
