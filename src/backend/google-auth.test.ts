import { describe, expect, it } from "vitest";
import { resolveGoogleAuthUser, validateProfileInput } from "@/backend/google-auth";

const googleUser = {
  sub: "google-sub-1",
  email: "user@gmail.com",
  emailVerified: true,
  name: "Nguyen Van A",
  picture: "https://example.com/avatar.jpg",
};

describe("resolveGoogleAuthUser", () => {
  it("logs in existing user matched by googleId", () => {
    const result = resolveGoogleAuthUser({
      googleUser,
      existingByGoogleId: {
        id: "staff-1",
        name: "Old Name",
        email: "user@gmail.com",
        googleId: "google-sub-1",
        avatarUrl: null,
      },
      existingByEmail: null,
      staffCount: 2,
      shopExists: true,
      intent: "login",
    });

    expect(result.action).toBe("login");
    if (result.action === "login") {
      expect(result.staffId).toBe("staff-1");
    }
  });

  it("rejects auto-link when email account exists without google", () => {
    const result = resolveGoogleAuthUser({
      googleUser,
      existingByGoogleId: null,
      existingByEmail: {
        id: "staff-2",
        name: "Lan",
        email: "user@gmail.com",
        googleId: null,
        avatarUrl: null,
      },
      staffCount: 2,
      shopExists: true,
      intent: "login",
    });

    expect(result).toEqual({
      action: "error",
      code: "google_account_exists",
      message:
        "Email này đã đăng ký bằng mật khẩu. Đăng nhập bằng mật khẩu, rồi liên kết Google trong Hồ sơ.",
    });
  });

  it("rejects register when google account already exists", () => {
    const result = resolveGoogleAuthUser({
      googleUser,
      existingByGoogleId: {
        id: "staff-1",
        name: "Old Name",
        email: "user@gmail.com",
        googleId: "google-sub-1",
        avatarUrl: null,
      },
      existingByEmail: null,
      staffCount: 2,
      shopExists: true,
      intent: "register",
    });

    expect(result.action).toBe("error");
    if (result.action === "error") {
      expect(result.code).toBe("google_already_registered");
    }
  });

  it("rejects login when no shop account exists", () => {
    const result = resolveGoogleAuthUser({
      googleUser,
      existingByGoogleId: null,
      existingByEmail: null,
      staffCount: 2,
      shopExists: true,
      intent: "login",
    });

    expect(result.action).toBe("error");
    if (result.action === "error") {
      expect(result.code).toBe("google_no_account");
    }
  });

  it("rejects email already linked to another google id", () => {
    const result = resolveGoogleAuthUser({
      googleUser,
      existingByGoogleId: null,
      existingByEmail: {
        id: "staff-3",
        name: "Other",
        email: "user@gmail.com",
        googleId: "google-sub-other",
        avatarUrl: null,
      },
      staffCount: 2,
      shopExists: true,
      intent: "register",
    });

    expect(result.action).toBe("error");
    if (result.action === "error") {
      expect(result.code).toBe("google_email_linked_other");
    }
  });

  it("creates owner when registering and no staff exists", () => {
    const result = resolveGoogleAuthUser({
      googleUser,
      existingByGoogleId: null,
      existingByEmail: null,
      staffCount: 0,
      shopExists: false,
      intent: "register",
    });

    expect(result.action).toBe("create");
    if (result.action === "create") {
      expect(result.role).toBe("admin");
      expect(result.createShop).toEqual({ id: "shop1", name: "ShopInbox" });
    }
  });

  it("creates staff when registering into an existing shop", () => {
    const result = resolveGoogleAuthUser({
      googleUser,
      existingByGoogleId: null,
      existingByEmail: null,
      staffCount: 3,
      shopExists: true,
      intent: "register",
    });

    expect(result.action).toBe("create");
    if (result.action === "create") {
      expect(result.role).toBe("staff");
      expect(result.createShop).toBeUndefined();
    }
  });

  it("rejects unverified email", () => {
    const result = resolveGoogleAuthUser({
      googleUser: { ...googleUser, emailVerified: false },
      existingByGoogleId: null,
      existingByEmail: null,
      staffCount: 1,
      shopExists: true,
      intent: "register",
    });

    expect(result.action).toBe("error");
  });
});

describe("validateProfileInput", () => {
  it("accepts valid profile fields", () => {
    const result = validateProfileInput({
      name: "Minh",
      phone: "0901 234 567",
      avatarUrl: "https://cdn.example.com/a.png",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects empty name", () => {
    const result = validateProfileInput({ name: "  " });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid avatar url", () => {
    const result = validateProfileInput({
      name: "Minh",
      avatarUrl: "ftp://bad",
    });
    expect(result.ok).toBe(false);
  });
});
