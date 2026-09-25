import { afterEach, describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "./token-crypto";

const KEY = "SESSION_SECRET";
const previous = process.env[KEY];

afterEach(() => {
  if (previous === undefined) delete process.env[KEY];
  else process.env[KEY] = previous;
});

describe("token-crypto", () => {
  it("round-trip và giữ plaintext cũ", () => {
    process.env[KEY] = "shopinbox-dev-session-secret-change-me";
    const sealed = sealSecret("page-token-1");
    expect(sealed?.startsWith("enc:v1:")).toBe(true);
    expect(openSecret(sealed)).toBe("page-token-1");
    expect(openSecret("legacy-plain")).toBe("legacy-plain");
    expect(openSecret(null)).toBeNull();
  });
});
