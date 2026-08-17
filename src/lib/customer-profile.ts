export const CUSTOMER_NOTE_MAX = 500;
export const CUSTOMER_ADDRESS_MAX = 200;
const PHONE_RE = /^[\d\s+\-().]{6,20}$/;

export type CustomerProfileInput = {
  phone: string | null;
  address: string | null;
  note: string | null;
};

export type CustomerProfileParseResult =
  | { ok: true; profile: CustomerProfileInput }
  | { ok: false; error: string };

export function parseCustomerProfileInput(raw: {
  phone?: unknown;
  address?: unknown;
  note?: unknown;
}): CustomerProfileParseResult {
  const phone = String(raw.phone ?? "").trim();
  const address = String(raw.address ?? "").trim();
  const note = String(raw.note ?? "").trim();

  if (phone && !PHONE_RE.test(phone)) {
    return { ok: false, error: "Số điện thoại không hợp lệ." };
  }
  if (address.length > CUSTOMER_ADDRESS_MAX) {
    return { ok: false, error: `Địa chỉ tối đa ${CUSTOMER_ADDRESS_MAX} ký tự.` };
  }
  if (note.length > CUSTOMER_NOTE_MAX) {
    return { ok: false, error: `Ghi chú tối đa ${CUSTOMER_NOTE_MAX} ký tự.` };
  }

  return {
    ok: true,
    profile: {
      phone: phone || null,
      address: address || null,
      note: note || null,
    },
  };
}

export function customerMatchesQuery(
  customer: { name: string; phone?: string | null; note?: string | null },
  query: string,
) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const phoneDigits = (customer.phone ?? "").replace(/\D/g, "");
  const needleDigits = needle.replace(/\D/g, "");
  if (customer.name.toLowerCase().includes(needle)) return true;
  if ((customer.phone ?? "").toLowerCase().includes(needle)) return true;
  if (needleDigits.length >= 3 && phoneDigits.includes(needleDigits)) return true;
  if ((customer.note ?? "").toLowerCase().includes(needle)) return true;
  return false;
}
