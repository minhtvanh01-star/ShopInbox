import { roleCodeForNewStaff } from "@/lib/rbac-catalog";
import { REGISTER_MIN_PASSWORD_LENGTH } from "@/lib/auth-password";

/** Shop mặc định — khớp DEMO_SHOP_ID / Google signup */
export const REGISTER_DEFAULT_SHOP_ID = "shop1";
export const REGISTER_DEFAULT_SHOP_NAME = "ShopInbox";
export { REGISTER_MIN_PASSWORD_LENGTH };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type RegisterValidationResult =
  | {
      ok: true;
      data: { name: string; email: string; password: string };
    }
  | { ok: false; error: string };

export function validateRegisterInput(raw: {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}): RegisterValidationResult {
  const name = String(raw.name ?? "").trim();
  const email = String(raw.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(raw.password ?? "");
  const confirmPassword = String(raw.confirmPassword ?? "");

  if (!name) {
    return { ok: false, error: "Họ tên không được để trống." };
  }
  if (name.length > 100) {
    return { ok: false, error: "Họ tên tối đa 100 ký tự." };
  }
  if (!email) {
    return { ok: false, error: "Email không được để trống." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Email không hợp lệ." };
  }
  if (!password) {
    return { ok: false, error: "Mật khẩu không được để trống." };
  }
  if (password.length < REGISTER_MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Mật khẩu tối thiểu ${REGISTER_MIN_PASSWORD_LENGTH} ký tự.`,
    };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: "Mật khẩu xác nhận không khớp." };
  }

  return { ok: true, data: { name, email, password } };
}

export type PasswordResetValidationResult =
  | { ok: true; data: { email: string; password: string } }
  | { ok: false; error: string };

export function validatePasswordResetInput(raw: {
  email?: string;
  password?: string;
  confirmPassword?: string;
}): PasswordResetValidationResult {
  const email = String(raw.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(raw.password ?? "");
  const confirmPassword = String(raw.confirmPassword ?? "");

  if (!email) {
    return { ok: false, error: "Email không được để trống." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Email không hợp lệ." };
  }
  if (!password) {
    return { ok: false, error: "Mật khẩu mới không được để trống." };
  }
  if (password.length < REGISTER_MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Mật khẩu tối thiểu ${REGISTER_MIN_PASSWORD_LENGTH} ký tự.`,
    };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: "Mật khẩu xác nhận không khớp." };
  }

  return { ok: true, data: { email, password } };
}

export type RegisterPlanInput = {
  staffCount: number;
  shopExists: boolean;
  emailTaken: boolean;
};

export type RegisterPlan =
  | { ok: false; error: string }
  | {
      ok: true;
      role: string;
      shopId: string;
      createShop?: { id: string; name: string };
    };

/**
 * Quyết định vai trò / shop khi đăng ký mở.
 * - User đầu tiên → admin (bootstrap); tạo shop mặc định nếu chưa có.
 * - User sau → staff vào shop mặc định (`shop1`). Không tự tạo admin.
 */
export function planOpenRegistration(input: RegisterPlanInput): RegisterPlan {
  if (input.emailTaken) {
    return { ok: false, error: "Email này đã được đăng ký." };
  }

  const role = roleCodeForNewStaff(input.staffCount);
  return {
    ok: true,
    role,
    shopId: REGISTER_DEFAULT_SHOP_ID,
    createShop: input.shopExists
      ? undefined
      : {
          id: REGISTER_DEFAULT_SHOP_ID,
          name: REGISTER_DEFAULT_SHOP_NAME,
        },
  };
}
