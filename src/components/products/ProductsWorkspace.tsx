"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  createProductGroupAction,
  deleteProductAction,
  deleteProductGroupAction,
  type ProductFormState,
} from "@/app/(app)/products/actions";
import { PaginationBar } from "@/components/PaginationBar";
import { ProductEditor } from "@/components/products/ProductEditor";
import { ProductImportPanel } from "@/components/products/ProductImportPanel";
import { formatMoney } from "@/lib/labels";
import { PRODUCT_GROUP_NAME_MAX, VAT_POLICY_LABEL } from "@/lib/product-catalog";
import type { PageMeta } from "@/lib/pagination";
import type { Product, ProductGroup } from "@/lib/types";

const empty: ProductFormState = {};

type ViewMode = "list" | "create" | "edit" | "groups" | "import";

export function ProductsWorkspace({
  products,
  groups,
  suggestedCode,
  canManage,
  filters,
  pageMeta,
}: {
  products: Product[];
  groups: ProductGroup[];
  suggestedCode: string;
  canManage: boolean;
  filters: { q: string; groupId: string; selling: string };
  pageMeta: PageMeta;
}) {
  const [mode, setMode] = useState<ViewMode>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importTarget, setImportTarget] = useState<Product | null>(null);
  const [flash, setFlash] = useState<ProductFormState>({});
  const [deleteState, deleteAction, deletePending] = useActionState(deleteProductAction, empty);
  const [groupCreateState, groupCreateAction, groupCreatePending] = useActionState(
    createProductGroupAction,
    empty,
  );
  const [groupDeleteState, groupDeleteAction, groupDeletePending] = useActionState(
    deleteProductGroupAction,
    empty,
  );

  const editingProduct = products.find((item) => item.id === editingId) ?? null;
  const banner =
    flash.success || deleteState.success || groupCreateState.success || groupDeleteState.success;
  const bannerError =
    flash.error || deleteState.error || groupCreateState.error || groupDeleteState.error;

  function openCreate() {
    setFlash({});
    setEditingId(null);
    setMode("create");
  }

  function openEdit(id: string) {
    setFlash({});
    setEditingId(id);
    setMode("edit");
  }

  function openImport(product: Product) {
    setFlash({});
    setImportTarget(product);
    setMode("import");
  }

  function backToList(nextFlash?: ProductFormState) {
    setMode("list");
    setEditingId(null);
    setImportTarget(null);
    if (nextFlash) setFlash(nextFlash);
  }

  if (mode === "create" || (mode === "edit" && editingProduct)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="page-header">
          <h1 className="page-title">
            {mode === "create" ? "Thêm sản phẩm" : `Sửa «${editingProduct?.name}»`}
          </h1>
          <p className="page-subtitle">Catalog bán hàng — giá và SKU nằm ở biến thể.</p>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-6">
          <ProductEditor
            mode={mode === "create" ? "create" : "edit"}
            product={editingProduct ?? undefined}
            groups={groups}
            suggestedCode={suggestedCode}
            onCancel={() => backToList()}
            onSaved={(result) => backToList(result)}
          />
        </div>
      </div>
    );
  }

  if (mode === "import" && importTarget) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="page-header flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="page-title">Nhập biến thể Excel</h1>
            <p className="page-subtitle">
              Sản phẩm đã tạo sẵn — file Excel chỉ chứa các dòng biến thể (size / màu / SKU).
            </p>
          </div>
          <button type="button" className="btn-secondary min-h-11" onClick={() => backToList()}>
            ← Danh sách
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-6">
          <ProductImportPanel
            productId={importTarget.id}
            productCode={importTarget.code}
            productName={importTarget.name}
            onDone={(result) => backToList(result)}
          />
        </div>
      </div>
    );
  }

  if (mode === "groups") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="page-header flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="page-title">Nhóm sản phẩm</h1>
            <p className="page-subtitle">Gắn nhóm để lọc danh sách catalog.</p>
          </div>
          <button type="button" className="btn-secondary min-h-11" onClick={() => setMode("list")}>
            ← Danh sách sản phẩm
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-6">
          {groupCreateState.error || groupDeleteState.error ? (
            <p role="alert" className="alert-error mb-4">
              {groupCreateState.error || groupDeleteState.error}
            </p>
          ) : null}
          {groupCreateState.success || groupDeleteState.success ? (
            <p role="status" className="alert-success mb-4">
              {groupCreateState.success || groupDeleteState.success}
            </p>
          ) : null}

          {canManage ? (
            <form action={groupCreateAction} className="card-padded mb-4 flex flex-wrap gap-2">
              <label className="min-w-[16rem] flex-1 text-xs">
                <span className="label">Tên nhóm</span>
                <input
                  name="name"
                  required
                  maxLength={PRODUCT_GROUP_NAME_MAX}
                  placeholder="Đồng phục học sinh"
                  className="input-field-sm min-h-11"
                />
              </label>
              <button
                type="submit"
                disabled={groupCreatePending}
                className="btn-primary-sm mt-5 min-h-11"
              >
                {groupCreatePending ? "Đang thêm…" : "Thêm nhóm"}
              </button>
            </form>
          ) : null}

          <ul className="space-y-2">
            {groups.length === 0 ? (
              <li className="empty-state text-sm">Chưa có nhóm.</li>
            ) : (
              groups.map((group) => (
                <li
                  key={group.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <span className="font-medium text-slate-900">{group.name}</span>
                  {canManage ? (
                    <form action={groupDeleteAction}>
                      <input type="hidden" name="id" value={group.id} />
                      <button
                        type="submit"
                        disabled={groupDeletePending}
                        className="btn-ghost min-h-10 text-xs text-rose-700"
                        onClick={(event) => {
                          if (!window.confirm(`Xóa nhóm «${group.name}»?`)) {
                            event.preventDefault();
                          }
                        }}
                      >
                        Xóa
                      </button>
                    </form>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Danh sách sản phẩm</h1>
          <p className="page-subtitle">
            Catalog bán hàng — đơn giá quản lý theo biến thể. {pageMeta.total} sản phẩm.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/products/summary" className="btn-secondary min-h-11">
            Tổng hợp
          </Link>
          {canManage ? (
            <>
              <button type="button" className="btn-secondary min-h-11" onClick={() => setMode("groups")}>
                Nhóm sản phẩm
              </button>
              <button type="button" className="btn-primary min-h-11" onClick={openCreate}>
                + Thêm sản phẩm
              </button>
            </>
          ) : null}
        </div>
      </header>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 border-b border-border bg-surface px-6 py-4"
      >
        <label className="min-w-[16rem] flex-1 text-xs">
          <span className="label">Tìm kiếm</span>
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Tìm mã hoặc tên sản phẩm…"
            className="input-field-sm min-h-11"
          />
        </label>
        <label className="text-xs">
          <span className="label">Nhóm</span>
          <select name="groupId" defaultValue={filters.groupId} className="input-field-sm min-h-11 min-w-[12rem]">
            <option value="all">Tất cả nhóm</option>
            <option value="none">Chưa nhóm</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="label">Trạng thái</span>
          <select name="selling" defaultValue={filters.selling} className="input-field-sm min-h-11">
            <option value="all">Tất cả</option>
            <option value="1">Đang bán</option>
            <option value="0">Ngưng bán</option>
          </select>
        </label>
        <button type="submit" className="btn-primary-sm min-h-11">
          Lọc
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {bannerError ? (
          <p role="alert" className="alert-error mb-4">
            {bannerError}
          </p>
        ) : null}
        {banner ? (
          <p role="status" className="alert-success mb-4">
            {banner}
          </p>
        ) : null}

        {products.length === 0 ? (
          <div className="empty-state">
            <p className="text-base font-medium text-slate-700">Chưa có sản phẩm phù hợp</p>
            <p className="mt-1 text-sm text-slate-500">
              {canManage
                ? "Thêm sản phẩm trước, rồi nhập Excel biến thể trên từng dòng."
                : "Liên hệ người có quyền tạo đơn để thêm kho."}
            </p>
          </div>
        ) : (
          <>
            <div className="table-shell overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3.5 font-semibold">Mã</th>
                    <th className="px-4 py-3.5 font-semibold">Tên</th>
                    <th className="px-4 py-3.5 font-semibold">Nhóm</th>
                    <th className="px-4 py-3.5 font-semibold">VAT</th>
                    <th className="px-4 py-3.5 font-semibold">Trạng thái</th>
                    <th className="px-4 py-3.5 font-semibold">Biến thể</th>
                    {canManage ? <th className="px-4 py-3.5 font-semibold">Thao tác</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => {
                    const sellingCount = product.variants.filter((item) => item.selling).length;
                    const offCount = product.variants.length - sellingCount;
                    const priceHint =
                      product.variants.length > 0
                        ? formatMoney(Math.min(...product.variants.map((item) => item.price)))
                        : "—";
                    return (
                      <tr
                        key={product.id}
                        className={`border-t border-border ${
                          index % 2 === 1 ? "bg-surface-muted/50" : "bg-surface"
                        }`}
                      >
                        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-700">
                          {product.code}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slate-900">{product.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">Từ {priceHint}</p>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{product.groupName ?? "—"}</td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {VAT_POLICY_LABEL[product.vatPolicy]}
                          {product.vatPolicy === "taxable" && product.taxRate != null
                            ? ` (${product.taxRate}%)`
                            : ""}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                              product.selling
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                                : "bg-slate-100 text-slate-500 ring-slate-200"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                product.selling ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {product.selling ? "Có sẵn" : "Ngưng bán"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-slate-800">
                            {product.variants.length} biến thể
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            <span className="text-emerald-700">{sellingCount} đang bán</span>
                            {" — "}
                            {offCount} tắt
                          </p>
                        </td>
                        {canManage ? (
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn-secondary min-h-11 px-3 text-xs"
                                onClick={() => openEdit(product.id)}
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                className="btn-secondary min-h-11 px-3 text-xs"
                                onClick={() => openImport(product)}
                              >
                                Excel BT
                              </button>
                              <form action={deleteAction}>
                                <input type="hidden" name="id" value={product.id} />
                                <button
                                  type="submit"
                                  disabled={deletePending}
                                  className="btn-ghost min-h-11 px-3 text-xs text-rose-700"
                                  onClick={(event) => {
                                    if (
                                      !window.confirm(
                                        `Xóa «${product.name}» và toàn bộ biến thể?`,
                                      )
                                    ) {
                                      event.preventDefault();
                                    }
                                  }}
                                >
                                  Xóa
                                </button>
                              </form>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar
              basePath="/products"
              params={{
                q: filters.q || undefined,
                groupId: filters.groupId !== "all" ? filters.groupId : undefined,
                selling: filters.selling !== "all" ? filters.selling : undefined,
              }}
              meta={pageMeta}
            />
          </>
        )}
      </div>
    </div>
  );
}
