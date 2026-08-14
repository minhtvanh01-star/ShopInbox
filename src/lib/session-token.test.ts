import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/session-token";

describe("session-token", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "shopinbox-test-session-secret";
  });

  it("round-trips a valid session payload", async () => {
    const payload = {
      staffId: "staff1",
      shopId: "shop1",
      email: "admin@lily.vn",
      name: "Minh",
      role: "owner" as const,
    };

    const token = await createSessionToken(payload);
    const verified = await verifySessionToken(token);

    expect(verified).toEqual(payload);
  });

  it("rejects tampered tokens", async () => {
    const token = await createSessionToken({
      staffId: "staff1",
      shopId: "shop1",
      email: "admin@lily.vn",
      name: "Minh",
      role: "owner",
    });

    expect(await verifySessionToken(`${token}x`)).toBeNull();
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });
});
