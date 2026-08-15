import { describe, expect, it } from "vitest";
import { resolveSeedMode } from "@/backend/db-seed-policy";

describe("resolveSeedMode", () => {
  it("replaces local data by default", () => {
    expect(resolveSeedMode({}, 2)).toBe("replace");
  });

  it("inserts demo data on empty Railway/production DB", () => {
    expect(resolveSeedMode({ NODE_ENV: "production" }, 0)).toBe("insert");
    expect(resolveSeedMode({ RAILWAY_ENVIRONMENT: "production" }, 0)).toBe("insert");
  });

  it("skips demo data when hosted DB already has shops", () => {
    expect(resolveSeedMode({ NODE_ENV: "production" }, 1)).toBe("skip");
    expect(resolveSeedMode({ RAILWAY_ENVIRONMENT: "production" }, 3)).toBe("skip");
  });

  it("SEED_FORCE always replaces", () => {
    expect(resolveSeedMode({ NODE_ENV: "production", SEED_FORCE: "1" }, 4)).toBe("replace");
  });
});
