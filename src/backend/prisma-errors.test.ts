import { describe, expect, it } from "vitest";
import { isMissingDbColumnError } from "./prisma-errors";

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
