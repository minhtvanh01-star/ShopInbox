import { describe, expect, it } from "vitest";
import {
  planOpenRegistration,
  validateRegisterInput,
  REGISTER_DEFAULT_SHOP_ID,
  REGISTER_MIN_PASSWORD_LENGTH,
} from "@/backend/register";

describe("validateRegisterInput", () => {
  it("accepts valid registration fields", () => {
    const result = validateRegisterInput({
      name: "  Nguyen Van A  ",
      email: "  User@Example.com ",
      password: "Password1",
      confirmPassword: "Password1",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        name: "Nguyen Van A",
        email: "user@example.com",
        password: "Password1",
      },
    });
  });

  it("requires name", () => {
    const result = validateRegisterInput({
      name: "   ",
      email: "a@b.co",
      password: "Password1",
      confirmPassword: "Password1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Họ tên/);
  });

  it("rejects invalid email", () => {
    const result = validateRegisterInput({
      name: "A",
      email: "not-an-email",
      password: "Password1",
      confirmPassword: "Password1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Email/);
  });

  it("enforces minimum password length", () => {
    const short = "x".repeat(REGISTER_MIN_PASSWORD_LENGTH - 1);
    const result = validateRegisterInput({
      name: "A",
      email: "a@b.co",
      password: short,
      confirmPassword: short,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/8/);
  });

  it("requires matching passwords", () => {
    const result = validateRegisterInput({
      name: "A",
      email: "a@b.co",
      password: "Password1",
      confirmPassword: "Password2",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/không khớp/);
  });
});

describe("planOpenRegistration", () => {
  it("rejects duplicate email", () => {
    const result = planOpenRegistration({
      staffCount: 0,
      shopExists: false,
      emailTaken: true,
    });
    expect(result).toEqual({
      ok: false,
      error: "Email này đã được đăng ký.",
    });
  });

  it("makes first user admin and creates default shop", () => {
    const result = planOpenRegistration({
      staffCount: 0,
      shopExists: false,
      emailTaken: false,
    });
    expect(result).toEqual({
      ok: true,
      role: "admin",
      shopId: REGISTER_DEFAULT_SHOP_ID,
      createShop: { id: REGISTER_DEFAULT_SHOP_ID, name: "ShopInbox" },
    });
  });

  it("assigns staff to existing default shop for later users", () => {
    const result = planOpenRegistration({
      staffCount: 2,
      shopExists: true,
      emailTaken: false,
    });
    expect(result).toEqual({
      ok: true,
      role: "staff",
      shopId: REGISTER_DEFAULT_SHOP_ID,
      createShop: undefined,
    });
  });
});
