import type { GoogleUserInfo } from "@/backend/google-oauth";
import { isActiveForOpenRegistration, roleCodeForNewStaff } from "@/lib/rbac-catalog";

/** Shop mặc định — khớp DEMO_SHOP_ID trong lib/queries.ts */
const DEFAULT_SHOP_ID = "shop1";

type StaffRecord = {
  id: string;
  name: string;
  email: string;
  googleId: string | null;
  avatarUrl: string | null;
};

export type GoogleAuthIntent = "login" | "register";

export type GoogleAuthResolveInput = {
  googleUser: GoogleUserInfo;
  existingByGoogleId: StaffRecord | null;
  existingByEmail: StaffRecord | null;
  staffCount: number;
  shopExists: boolean;
  intent: GoogleAuthIntent;
};

export type GoogleAuthResolveResult =
  | {
      action: "login";
      staffId: string;
      updateProfile?: { name?: string; avatarUrl?: string };
    }
  | {
      action: "create";
      email: string;
      name: string;
      googleId: string;
      avatarUrl?: string;
      role: string;
      shopId: string;
      /** false = chờ admin phê duyệt / phân quyền trước khi đăng nhập. */
      isActive: boolean;
      createShop?: { id: string; name: string };
    }
  | { action: "error"; code: string; message: string };

export function resolveGoogleAuthUser(input: GoogleAuthResolveInput): GoogleAuthResolveResult {
  const { googleUser, existingByGoogleId, existingByEmail, staffCount, shopExists, intent } = input;

  if (!googleUser.emailVerified) {
    return {
      action: "error",
      code: "google_email_unverified",
      message: "Email Google chưa được xác minh.",
    };
  }

  if (existingByGoogleId) {
    if (intent === "register") {
      return {
        action: "error",
        code: "google_already_registered",
        message: "Tài khoản Google này đã tồn tại. Hãy đăng nhập.",
      };
    }

    return {
      action: "login",
      staffId: existingByGoogleId.id,
      updateProfile: {
        name: googleUser.name,
        avatarUrl: googleUser.picture,
      },
    };
  }

  if (existingByEmail) {
    if (existingByEmail.googleId && existingByEmail.googleId !== googleUser.sub) {
      return {
        action: "error",
        code: "google_email_linked_other",
        message: "Email này đã liên kết tài khoản Google khác.",
      };
    }

    return {
      action: "error",
      code: "google_account_exists",
      message:
        "Email này đã đăng ký bằng mật khẩu. Đăng nhập bằng mật khẩu, rồi liên kết Google trong Hồ sơ.",
    };
  }

  if (intent === "login") {
    return {
      action: "error",
      code: "google_no_account",
      message: "Chưa có tài khoản với Google này. Hãy đăng ký trước.",
    };
  }

  const role = roleCodeForNewStaff(staffCount);

  return {
    action: "create",
    email: googleUser.email,
    name: googleUser.name,
    googleId: googleUser.sub,
    avatarUrl: googleUser.picture,
    role,
    shopId: DEFAULT_SHOP_ID,
    isActive: isActiveForOpenRegistration(staffCount),
    createShop: shopExists
      ? undefined
      : {
          id: DEFAULT_SHOP_ID,
          name: "ShopInbox",
        },
  };
}

export type ProfileInput = {
  name: string;
  phone: string;
  avatarUrl: string;
};

export type ProfileValidationResult =
  | { ok: true; data: ProfileInput }
  | { ok: false; error: string };

export function validateProfileInput(raw: {
  name?: string;
  phone?: string;
  avatarUrl?: string;
}): ProfileValidationResult {
  const name = String(raw.name ?? "").trim();
  const phone = String(raw.phone ?? "").trim();
  const avatarUrl = String(raw.avatarUrl ?? "").trim();

  if (!name) {
    return { ok: false, error: "Họ tên không được để trống." };
  }
  if (name.length > 100) {
    return { ok: false, error: "Họ tên tối đa 100 ký tự." };
  }
  if (phone && !/^[\d\s+\-().]{6,20}$/.test(phone)) {
    return { ok: false, error: "Số điện thoại không hợp lệ." };
  }
  if (avatarUrl && !/^https?:\/\/.+/i.test(avatarUrl)) {
    return { ok: false, error: "URL ảnh đại diện phải bắt đầu bằng http:// hoặc https://." };
  }

  return {
    ok: true,
    data: {
      name,
      phone,
      avatarUrl,
    },
  };
}
