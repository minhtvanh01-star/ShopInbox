import { describe, expect, it } from "vitest";
import {
  planOpenRegistration,
  validateRegisterInput,
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
      emailTaken: true,
    });
    expect(result).toEqual({
      ok: false,
      error: "Email này đã được đăng ký.",
    });
  });

  it("makes every open registration a shop owner", () => {
    expect(planOpenRegistration({ emailTaken: false })).toEqual({
      ok: true,
      role: "admin",
      isActive: true,
    });
  });
});
