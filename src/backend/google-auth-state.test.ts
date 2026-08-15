import { beforeEach, describe, expect, it } from "vitest";
import {
  createGoogleAuthStateToken,
  createGooglePkceToken,
  verifyGoogleAuthStateToken,
  verifyGooglePkceToken,
} from "@/backend/google-auth-state";

describe("google-auth-state", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "shopinbox-test-session-secret";
  });

  it("round-trips register mode", async () => {
    const token = await createGoogleAuthStateToken({
      nonce: "nonce-1",
      next: "/inbox",
      mode: "register",
    });

    await expect(verifyGoogleAuthStateToken(token)).resolves.toEqual({
      nonce: "nonce-1",
      next: "/inbox",
      mode: "register",
      staffId: undefined,
    });
  });

  it("rejects link mode without staffId", async () => {
    const token = await createGoogleAuthStateToken({
      nonce: "nonce-1",
      next: "/settings/profile",
      mode: "link",
    });

    await expect(verifyGoogleAuthStateToken(token)).resolves.toBeNull();
  });

  it("rejects tampered state tokens", async () => {
    const token = await createGoogleAuthStateToken({
      nonce: "nonce-1",
      next: "/inbox",
      mode: "login",
    });

    await expect(verifyGoogleAuthStateToken(`${token}x`)).resolves.toBeNull();
  });

  it("round-trips a PKCE verifier", async () => {
    const verifier = "a".repeat(43);
    const token = await createGooglePkceToken(verifier);
    await expect(verifyGooglePkceToken(token)).resolves.toBe(verifier);
  });

  it("rejects a short PKCE verifier", async () => {
    const token = await createGooglePkceToken("too-short");
    await expect(verifyGooglePkceToken(token)).resolves.toBeNull();
  });
});
