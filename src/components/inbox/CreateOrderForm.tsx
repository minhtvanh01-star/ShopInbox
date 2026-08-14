"use client";

import { useMemo, useState, useTransition } from "react";
import { createOrder } from "@/app/(app)/actions";
import { formatMoney } from "@/lib/labels";
import type { Product } from "@/lib/types";

type Line = {
  key: string;
  productId: string;
  qty: number;
};

type CreateOrderFormProps = {
  conversationId: string;
  customerName: string;
  defaultPhone?: string;
  defaultAddress?: string;
  products: Product[];
  onClose: () => void;
};

export function CreateOrderForm({
  conversationId,
  customerName,
  defaultPhone,
  defaultAddress,
  products,
  onClose,
}: CreateOrderFormProps) {
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [address, setAddress] = useState(defaultAddress ?? "");
  const [lines, setLines] = useState<Line[]>([
    { key: "line-1", productId: products[0]?.id ?? "", qty: 1 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const total = useMemo(() => {
    return lines.reduce((sum, line) => {
      const product = products.find((item) => item.id === line.productId);
      if (!product || line.qty < 1) return sum;
      return sum + product.price * line.qty;
    }, 0);
  }, [lines, products]);

  function addLine() {
    setLines((current) => [
      ...current,
      {
        key: `line-${current.length + 1}-${crypto.randomUUID()}`,
        productId: products[0]?.id ?? "",
        qty: 1,
      },
    ]);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createOrder({
          conversationId,
          address,
          phone,
          items: lines.map((line) => ({ productId: line.productId, qty: line.qty })),
        });
        if (result.code) {
          onClose();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tạo được đơn");
      }
    });
  }

  return (
    <div className="form-panel-accent mt-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Tạo đơn cho {customerName}</h3>
        <button type="button" onClick={onClose} className="btn-ghost px-2 py-1 text-xs">
          Đóng
        </button>
      </div>

      <div className="field-group mt-4">
        <label className="label mb-0">SĐT</label>
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="input-field-sm"
          placeholder="09xx xxx xxx"
        />
      </div>

      <div className="field-group mt-3">
        <label className="label mb-0">Địa chỉ giao</label>
        <textarea
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          rows={2}
          placeholder="Số nhà, đường, quận..."
          className="textarea-field"
        />
      </div>

      <div className="mt-4">
        <p className="section-label mb-2">Sản phẩm</p>
        <div className="space-y-2">
          {lines.map((line) => (
            <div
              key={line.key}
              className="flex gap-2 rounded-lg border border-border bg-surface p-2 transition-colors duration-150"
            >
              <select
                value={line.productId}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item) =>
                      item.key === line.key ? { ...item, productId: event.target.value } : item,
                    ),
                  )
                }
                className="input-field-sm h-10 min-w-0 flex-1 border-0 bg-transparent px-1 focus:ring-0"
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {formatMoney(product.price)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={line.qty}
                onChange={(event) =>
                  setLines((current) =>
                    current.map((item) =>
                      item.key === line.key
                        ? { ...item, qty: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
                className="input-field-sm h-10 w-16 shrink-0"
                aria-label="Số lượng"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={addLine}
        className="mt-2 text-xs font-semibold text-teal-700 transition-colors duration-150 hover:text-teal-800"
      >
        + Thêm sản phẩm
      </button>

      <div className="mt-4 flex items-baseline justify-between border-t border-teal-200/60 pt-3">
        <span className="text-sm text-slate-600">Tổng cộng</span>
        <span className="text-base font-semibold text-slate-900">{formatMoney(total)}</span>
      </div>

      {error ? <p className="alert-error mt-3 text-xs">{error}</p> : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={isPending || products.length === 0}
          onClick={submit}
          className="btn-primary flex-1"
        >
          {isPending ? "Đang lưu..." : "Lưu đơn"}
        </button>
        <button type="button" onClick={onClose} className="btn-secondary shrink-0">
          Hủy
        </button>
      </div>
    </div>
  );
}
