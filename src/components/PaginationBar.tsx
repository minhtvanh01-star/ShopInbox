import Link from "next/link";
import { buildPageHref, type PageMeta } from "@/lib/pagination";

export function PaginationBar({
  basePath,
  params,
  meta,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  meta: PageMeta;
}) {
  if (meta.total === 0) return null;

  const prev = meta.page > 1 ? buildPageHref(basePath, params, meta.page - 1) : null;
  const next =
    meta.page < meta.pageCount ? buildPageHref(basePath, params, meta.page + 1) : null;

  return (
    <nav
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"
      aria-label="Phân trang"
    >
      <p>
        {meta.total} kết quả · Trang {meta.page} / {meta.pageCount}
      </p>
      <div className="flex gap-2">
        {prev ? (
          <Link href={prev} className="btn-secondary min-h-10 px-3 text-xs">
            ← Trước
          </Link>
        ) : (
          <span className="btn-secondary min-h-10 cursor-not-allowed px-3 text-xs opacity-40">
            ← Trước
          </span>
        )}
        {next ? (
          <Link href={next} className="btn-secondary min-h-10 px-3 text-xs">
            Sau →
          </Link>
        ) : (
          <span className="btn-secondary min-h-10 cursor-not-allowed px-3 text-xs opacity-40">
            Sau →
          </span>
        )}
      </div>
    </nav>
  );
}
