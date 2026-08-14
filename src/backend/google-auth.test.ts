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
    });

    expect(result.action).toBe("login");
    if (result.action === "login") {
      expect(result.staffId).toBe("staff-1");
    }
  });

  it("links googleId when email account exists without google", () => {
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
    });

    expect(result).toEqual({
      action: "login",
      staffId: "staff-2",
      linkGoogleId: "google-sub-1",
      updateProfile: {
        name: "Lan",
        avatarUrl: "https://example.com/avatar.jpg",
      },
    });
  });

  it("creates owner when no staff exists", () => {
    const result = resolveGoogleAuthUser({
      googleUser,
      existingByGoogleId: null,
      existingByEmail: null,
      staffCount: 0,
      shopExists: false,
    });

    expect(result.action).toBe("create");
    if (result.action === "create") {
      expect(result.role).toBe("admin");
      expect(result.createShop).toEqual({ id: "shop1", name: "ShopInbox" });
    }
  });

  it("creates staff when shop already has users", () => {
    const result = resolveGoogleAuthUser({
      googleUser,
      existingByGoogleId: null,
      existingByEmail: null,
      staffCount: 3,
      shopExists: true,
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
