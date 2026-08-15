import { describe, expect, it } from "vitest";
import {
  assertGoogleIdentitiesMatch,
  buildGoogleOAuthUrl,
  createCodeChallenge,
  generateCodeVerifier,
  googleUserFromIdTokenPayload,
} from "@/backend/google-oauth";

describe("PKCE", () => {
  it("generates a verifier long enough for S256", () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("creates a deterministic S256 challenge", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await createCodeChallenge(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("buildGoogleOAuthUrl", () => {
  it("includes nonce and PKCE challenge", () => {
    const url = new URL(
      buildGoogleOAuthUrl(
        {
          clientId: "client-1",
          clientSecret: "secret-1",
          redirectUri: "http://localhost:3000/api/auth/google/callback",
        },
        {
          state: "state-token",
          nonce: "nonce-1",
          codeChallenge: "challenge-1",
        },
      ),
    );

    expect(url.searchParams.get("nonce")).toBe("nonce-1");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-1");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("state-token");
  });
});

describe("googleUserFromIdTokenPayload", () => {
  it("normalizes email and requires verified flag", () => {
    const user = googleUserFromIdTokenPayload({
      sub: "sub-1",
      email: "  User@Gmail.com ",
      email_verified: true,
      name: "Lan",
      picture: "https://example.com/a.png",
    });

    expect(user).toEqual({
      sub: "sub-1",
      email: "user@gmail.com",
      emailVerified: true,
      name: "Lan",
      picture: "https://example.com/a.png",
    });
  });

  it("rejects missing email", () => {
    expect(() => googleUserFromIdTokenPayload({ sub: "sub-1" })).toThrow(/email/);
  });
});

describe("assertGoogleIdentitiesMatch", () => {
  const user = {
    sub: "sub-1",
    email: "user@gmail.com",
    emailVerified: true,
    name: "Lan",
  };

  it("accepts matching identities", () => {
    expect(() => assertGoogleIdentitiesMatch(user, { ...user, name: "Other" })).not.toThrow();
  });

  it("rejects mismatched sub", () => {
    expect(() => assertGoogleIdentitiesMatch(user, { ...user, sub: "other" })).toThrow(/không khớp/);
  });
});
