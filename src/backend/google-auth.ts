import type { GoogleUserInfo } from "@/backend/google-oauth";
import { roleCodeForNewStaff } from "@/lib/rbac-catalog";

/** Shop mặc định — khớp DEMO_SHOP_ID trong lib/queries.ts */
const DEFAULT_SHOP_ID = "shop1";

type StaffRecord = {
  id: string;
  name: string;
  email: string;
  googleId: string | null;
  avatarUrl: string | null;
};

export type GoogleAuthResolveInput = {
  googleUser: GoogleUserInfo;
  existingByGoogleId: StaffRecord | null;
  existingByEmail: StaffRecord | null;
  staffCount: number;
  shopExists: boolean;
};

export type GoogleAuthResolveResult =
  | {
      action: "login";
      staffId: string;
      linkGoogleId?: string;
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
      createShop?: { id: string; name: string };
    }
  | { action: "error"; code: string; message: string };

export function resolveGoogleAuthUser(input: GoogleAuthResolveInput): GoogleAuthResolveResult {
  const { googleUser, existingByGoogleId, existingByEmail, staffCount, shopExists } = input;

  if (!googleUser.emailVerified) {
    return {
      action: "error",
      code: "google_email_unverified",
      message: "Email Google chưa được xác minh.",
    };
  }

  if (existingByGoogleId) {
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
      action: "login",
      staffId: existingByEmail.id,
      linkGoogleId: googleUser.sub,
      updateProfile: {
        name: existingByEmail.name || googleUser.name,
        avatarUrl: googleUser.picture ?? existingByEmail.avatarUrl ?? undefined,
      },
    };
  }

  const role = roleCodeForNewStaff(staffCount);
  const shopId = shopExists ? DEFAULT_SHOP_ID : DEFAULT_SHOP_ID;

  return {
    action: "create",
    email: googleUser.email,
    name: googleUser.name,
    googleId: googleUser.sub,
    avatarUrl: googleUser.picture,
    role,
    shopId,
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
