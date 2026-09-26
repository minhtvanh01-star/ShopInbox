export const SHOP_NAME_MIN = 2;
export const SHOP_NAME_MAX = 80;

export function defaultShopNameFromOwner(ownerName: string) {
  const name = ownerName.trim() || "bạn";
  const proposed = `Cửa hàng của ${name}`;
  return proposed.slice(0, SHOP_NAME_MAX);
}

export function validateShopName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length < SHOP_NAME_MIN) {
    return { ok: false, error: `Tên cửa hàng tối thiểu ${SHOP_NAME_MIN} ký tự.` };
  }
  if (name.length > SHOP_NAME_MAX) {
    return { ok: false, error: `Tên cửa hàng tối đa ${SHOP_NAME_MAX} ký tự.` };
  }
  return { ok: true, name };
}
