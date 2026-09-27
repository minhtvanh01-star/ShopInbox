import { describe, expect, it } from "vitest";
import {
  CUSTOMER_ADDRESS_MAX,
  customerMatchesQuery,
  customerProfileChecklist,
  parseCustomerProfileInput,
  parseOrderDeliveryInput,
} from "./customer-profile";

describe("parseCustomerProfileInput", () => {
  it("accepts empty contact fields", () => {
    expect(parseCustomerProfileInput({ phone: "  ", address: "", note: "" })).toEqual({
      ok: true,
      profile: { phone: null, address: null, note: null },
    });
  });

  it("trims and keeps valid phone / note", () => {
    expect(
      parseCustomerProfileInput({
        phone: " 0901 234 567 ",
        address: " Cầu Giấy ",
        note: " Size M ",
      }),
    ).toEqual({
      ok: true,
      profile: { phone: "0901 234 567", address: "Cầu Giấy", note: "Size M" },
    });
  });

  it("rejects invalid phone", () => {
    expect(parseCustomerProfileInput({ phone: "abc" }).ok).toBe(false);
  });
});

describe("parseOrderDeliveryInput", () => {
  it("requires address and validates phone", () => {
    expect(parseOrderDeliveryInput({ address: "  ", phone: "" }).ok).toBe(false);
    expect(parseOrderDeliveryInput({ address: "Cầu Giấy", phone: "abc" }).ok).toBe(false);
    expect(parseOrderDeliveryInput({ address: "Cầu Giấy", phone: "0901234567" })).toEqual({
      ok: true,
      address: "Cầu Giấy",
      phone: "0901234567",
    });
  });

  it("rejects overly long address", () => {
    expect(parseOrderDeliveryInput({ address: "a".repeat(CUSTOMER_ADDRESS_MAX + 1) }).ok).toBe(
      false,
    );
  });
});

describe("customerProfileChecklist", () => {
  it("một hàng: SĐT / địa chỉ / ghi chú", () => {
    expect(
      customerProfileChecklist({ phone: "0901", address: "", note: "Size M" }),
    ).toEqual([
      { id: "phone", label: "SĐT", done: true },
      { id: "address", label: "Địa chỉ", done: false },
      { id: "note", label: "Ghi chú", done: true },
    ]);
  });
});

describe("customerMatchesQuery", () => {
  const customer = { name: "Pham Vu Anh Minh", phone: "0901 234 567", note: "Hay hỏi size" };

  it("matches name, phone digits, and note", () => {
    expect(customerMatchesQuery(customer, "anh minh")).toBe(true);
    expect(customerMatchesQuery(customer, "0901234")).toBe(true);
    expect(customerMatchesQuery(customer, "size")).toBe(true);
    expect(customerMatchesQuery(customer, "xyz")).toBe(false);
  });

  it("empty query matches all", () => {
    expect(customerMatchesQuery(customer, "  ")).toBe(true);
  });
});
