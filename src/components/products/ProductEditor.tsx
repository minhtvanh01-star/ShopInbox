"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createProductAction,
  updateProductAction,
  type ProductFormState,
} from "@/app/(app)/products/actions";
import {
  PRODUCT_CODE_MAX,
  PRODUCT_NAME_MAX,
  PRODUCT_SKU_MAX,
  VAT_POLICIES,
  VAT_POLICY_LABEL,
  type VatPolicyCode,
} from "@/lib/product-catalog";
import type { Product, ProductGroup, ProductVariant } from "@/lib/types";

type DraftVariant = {
  key: string;
  id?: string;
  sku: string;
  name: string;
  price: string;
  costPrice: string;
  selling: boolean;
};

type ProductEditorProps = {
  mode: "create" | "edit";
  product?: Product;
  groups: ProductGroup[];
  suggestedCode: string;
  onCancel: () => void;
  onSaved: (flash: ProductFormState) => void;
};

function toDraft(variants: ProductVariant[]): DraftVariant[] {
  if (variants.length === 0) {
    return [
      {
        key: crypto.randomUUID(),
        sku: "",
        name: "",
        price: "0",
        costPrice: "0",
        selling: true,
      },
    ];
  }
  return variants.map((variant) => ({
    key: variant.id,
    id: variant.id,
    sku: variant.sku ?? "",
    name: variant.name,
    price: String(variant.price),
    costPrice: String(variant.costPrice),
    selling: variant.selling,
  }));
}

export function ProductEditor({
  mode,
  product,
  groups,
  suggestedCode,
  onCancel,
  onSaved,
}: ProductEditorProps) {
  const [code, setCode] = useState(product?.code ?? suggestedCode);
  const [name, setName] = useState(product?.name ?? "");
  const [groupId, setGroupId] = useState(product?.groupId ?? "");
  const [vatPolicy, setVatPolicy] = useState<VatPolicyCode>(product?.vatPolicy ?? "exempt");
  const [taxRate, setTaxRate] = useState(
    product?.taxRate != null ? String(product.taxRate) : "10",
  );
  const [selling, setSelling] = useState(product?.selling ?? true);
  const [variants, setVariants] = useState<DraftVariant[]>(() =>
    toDraft(product?.variants ?? []),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const variantsJson = useMemo(
    () =>
      JSON.stringify(
        variants.map((variant, index) => ({
          id: variant.id,
          sku: variant.sku,
          name: variant.name,
          price: variant.price,
          costPrice: variant.costPrice,
          selling: variant.selling,
          sortOrder: index,
        })),
      ),
    [variants],
  );

  function addVariant() {
    setVariants((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        sku: "",
        name: "",
        price: "0",
        costPrice: "0",
        selling: true,
      },
    ]);
  }

  function updateVariant(key: string, patch: Partial<DraftVariant>) {
    setVariants((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function removeVariant(key: string) {
    setVariants((current) => (current.length <= 1 ? current : current.filter((row) => row.key !== key)));
  }

  function submit() {
    setError(null);
    const formData = new FormData();
    if (product?.id) formData.set("id", product.id);
    formData.set("code", code);
    formData.set("name", name);
    formData.set("groupId", groupId);
    formData.set("vatPolicy", vatPolicy);
    formData.set("taxRate", taxRate);
    if (selling) formData.set("selling", "on");
    formData.set("variantsJson", variantsJson);

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createProductAction({}, formData)
          : await updateProductAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved(result);
    });
  }

  return (
    <div className="space-y-4">
      <section className="card-padded space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Thông tin chung</h2>
          <p className="mt-1 text-xs text-slate-500">
            Mã và tên cho nhóm sản phẩm (vd. Áo khoác). Size / màu / SKU quản lý ở biến thể bên dưới —
            đơn hàng lấy giá theo biến thể.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            <span className="label">Mã sản phẩm *</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={PRODUCT_CODE_MAX}
              placeholder="SP010"
              className="input-field-sm min-h-11 font-mono uppercase"
              autoComplete="off"
            />
          </label>
          <label className="text-xs">
            <span className="label">Tên sản phẩm *</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={PRODUCT_NAME_MAX}
              placeholder="Áo khoác mùa đông"
              className="input-field-sm min-h-11"
              autoComplete="off"
            />
          </label>
          <label className="text-xs">
            <span className="label">Nhóm sản phẩm</span>
            <select
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              className="input-field-sm min-h-11"
            >
              <option value="">— Chưa nhóm —</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="label">Chính sách VAT</span>
            <select
              value={vatPolicy}
              onChange={(event) => setVatPolicy(event.target.value as VatPolicyCode)}
              className="input-field-sm min-h-11"
            >
              {VAT_POLICIES.map((policy) => (
                <option key={policy} value={policy}>
                  {VAT_POLICY_LABEL[policy]}
                </option>
              ))}
            </select>
          </label>
          {vatPolicy === "taxable" ? (
            <label className="text-xs">
              <span className="label">Thuế suất (%)</span>
              <input
                value={taxRate}
                onChange={(event) => setTaxRate(event.target.value)}
                inputMode="numeric"
                placeholder="10"
                className="input-field-sm min-h-11"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Chỉ áp dụng khi chịu thuế. Miễn thuế / 0% không tính VAT.
              </span>
            </label>
          ) : null}
          <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={selling}
              onChange={(event) => setSelling(event.target.checked)}
              className="size-5 rounded border"
            />
            Đang bán (hiện khi tạo đơn nếu biến thể cũng đang bán)
          </label>
        </div>
      </section>

      <section className="card-padded space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Biến thể (size / màu / SKU)</h2>
            <p className="mt-1 text-xs text-slate-500">
              Mỗi dòng là một mặt hàng bán được — đơn giá và trạng thái bán theo biến thể.
              {mode === "edit"
                ? " Có thể nhập hàng loạt bằng Excel từ danh sách (nút Excel BT)."
                : " Sau khi lưu sản phẩm, dùng Excel BT trên danh sách để nhập nhiều size/màu."}
            </p>
          </div>
          <button type="button" onClick={addVariant} className="btn-secondary min-h-10 text-xs">
            + Thêm biến thể
          </button>
        </div>

        <div className="space-y-3">
          {variants.map((variant, index) => (
            <div
              key={variant.key}
              className="rounded-xl border border-border bg-surface-muted/40 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700">Biến thể {index + 1}</p>
                {variants.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeVariant(variant.key)}
                    className="btn-ghost min-h-9 px-2 text-xs text-rose-700"
                  >
                    Xóa
                  </button>
                ) : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <label className="text-xs sm:col-span-2 lg:col-span-2">
                  <span className="label">Tên biến thể *</span>
                  <input
                    value={variant.name}
                    onChange={(event) => updateVariant(variant.key, { name: event.target.value })}
                    maxLength={PRODUCT_NAME_MAX}
                    placeholder="Size M / Đen"
                    className="input-field-sm min-h-11"
                  />
                </label>
                <label className="text-xs">
                  <span className="label">SKU</span>
                  <input
                    value={variant.sku}
                    onChange={(event) => updateVariant(variant.key, { sku: event.target.value })}
                    maxLength={PRODUCT_SKU_MAX}
                    placeholder="AK-M-DEN"
                    className="input-field-sm min-h-11"
                  />
                </label>
                <label className="text-xs">
                  <span className="label">Đơn giá (VND) *</span>
                  <input
                    value={variant.price}
                    onChange={(event) => updateVariant(variant.key, { price: event.target.value })}
                    inputMode="numeric"
                    className="input-field-sm min-h-11"
                  />
                </label>
                <label className="text-xs">
                  <span className="label">Giá vốn (VND)</span>
                  <input
                    value={variant.costPrice}
                    onChange={(event) =>
                      updateVariant(variant.key, { costPrice: event.target.value })
                    }
                    inputMode="numeric"
                    className="input-field-sm min-h-11"
                  />
                </label>
                <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700 sm:col-span-2 lg:col-span-5">
                  <input
                    type="checkbox"
                    checked={variant.selling}
                    onChange={(event) =>
                      updateVariant(variant.key, { selling: event.target.checked })
                    }
                    className="size-5 rounded border"
                  />
                  Đang bán biến thể này
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <p role="alert" className="alert-error">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary min-h-11">
          Huỷ
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="btn-primary min-h-11"
          aria-busy={pending}
        >
          {pending ? "Đang lưu…" : mode === "create" ? "Lưu sản phẩm" : "Cập nhật sản phẩm"}
        </button>
      </div>
    </div>
  );
}
