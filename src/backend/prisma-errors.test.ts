import { describe, expect, it } from "vitest";
import { isMissingDbColumnError, isUniqueConstraintError } from "./prisma-errors";

describe("isUniqueConstraintError", () => {
  it("detects P2002", () => {
    expect(isUniqueConstraintError(new Error("Unique constraint failed on the fields: (`code`)"))).toBe(
      true,
    );
    expect(isUniqueConstraintError(new Error("P2002"))).toBe(true);
    expect(isUniqueConstraintError(new Error("P2022 column missing"))).toBe(false);
  });
});

describe("isMissingDbColumnError", () => {
  it("detects Prisma P2022 / missing column messages", () => {
    expect(
      isMissingDbColumnError(
        new Error(
          "Invalid `prisma.shop.findUnique()` ... The column `shops.replyClaimTtlMinutes` does not exist in the current database.",
        ),
        "replyClaimTtlMinutes",
      ),
    ).toBe(true);
    expect(
      isMissingDbColumnError(
        new Error("P2022\nThe column `customers.avatarUrl` does not exist in the current database."),
        "avatarUrl",
      ),
    ).toBe(true);
    expect(isMissingDbColumnError(new Error("P2022\nColumn not found"))).toBe(true);
    expect(isMissingDbColumnError(new Error("Unique constraint failed"), "avatarUrl")).toBe(false);
  });
});
