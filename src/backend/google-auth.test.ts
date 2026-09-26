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

  it("auto-links a verified Google email to the existing password account on login", () => {
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
      action: "login",
      staffId: "staff-2",
      linkGoogleId: "google-sub-1",
      updateProfile: {
        name: "Nguyen Van A",
        avatarUrl: "https://example.com/avatar.jpg",
      },
    });
  });

  it("still blocks register when the email already has a password account", () => {
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
      intent: "register",
    });

    expect(result.action).toBe("error");
    if (result.action === "error") {
      expect(result.code).toBe("google_account_exists");
    }
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

  it("creates a shop owner when logging in with a new Google account", () => {
    const result = resolveGoogleAuthUser({
      googleUser,
      existingByGoogleId: null,
      existingByEmail: null,
      staffCount: 2,
      shopExists: true,
      intent: "login",
    });

    expect(result.action).toBe("create");
    if (result.action === "create") {
      expect(result.role).toBe("admin");
      expect(result.isActive).toBe(true);
      expect(result.googleId).toBe("google-sub-1");
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

  it("creates a shop owner when registering a new Google user", () => {
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
      expect(result.role).toBe("admin");
      expect(result.isActive).toBe(true);
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

  it("accepts a saved local upload path", () => {
    const result = validateProfileInput({
      name: "Minh",
      avatarUrl: "/api/uploads/shop1/abc.jpg",
    });
    expect(result.ok).toBe(true);
  });
});
