/** Phân trang danh sách (URL searchParams). */

export const PAGE_SIZE = 25;

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function paginationMeta(total: number, page: number, pageSize = PAGE_SIZE): PageMeta {
  const safeTotal = Math.max(0, Math.floor(total));
  const pageCount = Math.max(1, Math.ceil(safeTotal / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), pageCount);
  return { page: safePage, pageSize, total: safeTotal, pageCount };
}

export function paginationSkip(page: number, pageSize = PAGE_SIZE) {
  return (Math.max(1, page) - 1) * pageSize;
}

/** Ghép query giữ filter, đổi page (bỏ page=1 cho URL gọn). */
export function buildPageHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    if (value == null || value === "") continue;
    search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
