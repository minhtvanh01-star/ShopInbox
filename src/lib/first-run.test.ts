import { describe, expect, it } from "vitest";
import {
  readFirstAdminBootstrap,
  shouldSkipRegisterOtp,
} from "@/lib/first-run";

describe("shouldSkipRegisterOtp", () => {
  it("skips OTP only when the platform has no staff", () => {
    expect(shouldSkipRegisterOtp(0)).toBe(true);
    expect(shouldSkipRegisterOtp(1)).toBe(false);
  });
});

describe("readFirstAdminBootstrap", () => {
  it("requires email and a password of at least 8 characters", () => {
    expect(readFirstAdminBootstrap({})).toBeNull();
    expect(
      readFirstAdminBootstrap({
        SUPER_ADMIN_EMAIL: "boss@shop.vn",
        SUPER_ADMIN_PASSWORD: "short",
      }),
    ).toBeNull();
    expect(
      readFirstAdminBootstrap({
        SUPER_ADMIN_EMAIL: "Boss@Shop.vn",
        SUPER_ADMIN_PASSWORD: "Super@123",
        SUPER_ADMIN_NAME: " Điều hành ",
      }),
    ).toEqual({
      email: "boss@shop.vn",
      password: "Super@123",
      name: "Điều hành",
    });
  });

  it("accepts BOOTSTRAP_ADMIN_PASSWORD as an alias", () => {
    expect(
      readFirstAdminBootstrap({
        SUPER_ADMIN_EMAIL: "boss@shop.vn",
        BOOTSTRAP_ADMIN_PASSWORD: "Bootstrap1",
      }),
    ).toMatchObject({ email: "boss@shop.vn", password: "Bootstrap1" });
  });
});
