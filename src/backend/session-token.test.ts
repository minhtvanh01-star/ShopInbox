import { beforeEach, describe, expect, it } from "vitest";
import {
  createSessionToken,
  isSessionIdleExpired,
  shouldRefreshSession,
  verifySessionToken,
  SESSION_IDLE_MS,
  SESSION_REFRESH_INTERVAL_MS,
} from "@/backend/session-token";

describe("session-token", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "shopinbox-test-session-secret";
  });

  it("round-trips a valid session payload", async () => {
    const now = Date.parse("2026-08-15T10:00:00.000Z");
    const payload = {
      staffId: "staff1",
      shopId: "shop1",
      email: "admin@lily.vn",
      name: "Minh",
      role: "admin" as const,
      lastActiveAt: now,
      sessionVersion: 0,
    };

    const token = await createSessionToken(payload);
    const verified = await verifySessionToken(token, now);

    expect(verified).toEqual(payload);
  });

  it("rejects tampered tokens", async () => {
    const token = await createSessionToken({
      staffId: "staff1",
      shopId: "shop1",
      email: "admin@lily.vn",
      name: "Minh",
      role: "admin",
    });

    expect(await verifySessionToken(`${token}x`)).toBeNull();
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });

  it("normalizes legacy owner role to admin", async () => {
    const token = await createSessionToken({
      staffId: "staff1",
      shopId: "shop1",
      email: "admin@lily.vn",
      name: "Minh",
      role: "owner",
    });

    expect(await verifySessionToken(token)).toMatchObject({ role: "admin" });
  });

  it("rejects idle sessions after 30 minutes", async () => {
    const started = Date.parse("2026-08-15T10:00:00.000Z");
    const token = await createSessionToken({
      staffId: "staff1",
      shopId: "shop1",
      email: "admin@lily.vn",
      name: "Minh",
      role: "admin",
      lastActiveAt: started,
    });

    expect(await verifySessionToken(token, started + SESSION_IDLE_MS)).toMatchObject({
      staffId: "staff1",
    });
    expect(await verifySessionToken(token, started + SESSION_IDLE_MS + 1)).toBeNull();
  });

  it("round-trips shopSetupComplete when present", async () => {
    const now = Date.parse("2026-08-15T10:00:00.000Z");
    const token = await createSessionToken({
      staffId: "staff1",
      shopId: "shop1",
      email: "admin@lily.vn",
      name: "Minh",
      role: "admin",
      lastActiveAt: now,
      sessionVersion: 0,
      shopSetupComplete: false,
    });

    expect(await verifySessionToken(token, now)).toMatchObject({ shopSetupComplete: false });
  });

  it("computes idle and refresh windows", () => {
    const now = 1_000_000;
    expect(isSessionIdleExpired(now - SESSION_IDLE_MS - 1, now)).toBe(true);
    expect(isSessionIdleExpired(now - 60_000, now)).toBe(false);
    expect(shouldRefreshSession(now - SESSION_REFRESH_INTERVAL_MS, now)).toBe(true);
    expect(shouldRefreshSession(now - 1_000, now)).toBe(false);
  });
});
