import { describe, expect, it } from "vitest";
import { personInitials } from "@/components/inbox/CustomerAvatar";

describe("personInitials", () => {
  it("builds initials from full name", () => {
    expect(personInitials("Pham Vu Anh Minh")).toBe("PM");
    expect(personInitials("Minh")).toBe("MI");
    expect(personInitials("  ")).toBe("?");
  });
});
