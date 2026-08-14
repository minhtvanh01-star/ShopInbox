import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/backend/password";

describe("password", () => {
  it("hashes password and verifies the original", async () => {
    const password = "Admin@123";
    const hashed = await hashPassword(password);

    expect(hashed).not.toBe(password);
    expect(hashed.startsWith("$2")).toBe(true);
    expect(await verifyPassword(password, hashed)).toBe(true);
    expect(await verifyPassword("wrong-pass", hashed)).toBe(false);
  });

  it("produces different hashes for the same password (salt)", async () => {
    const password = "Staff@123";
    const a = await hashPassword(password);
    const b = await hashPassword(password);
    expect(a).not.toBe(b);
  });
});
