"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createOrder } from "@/app/(app)/actions";
import { ORDER_ITEM_QTY_MAX } from "@/backend/order-code";
import { CUSTOMER_ADDRESS_MAX } from "@/lib/customer-profile";
import { formatMoney } from "@/lib/labels";
import type { SellableVariant } from "@/lib/types";

type Line = {
  key: string;
  variantId: string;
  qty: number;
};

type CreateOrderFormProps = {
  conversationId: string;
  customerName: string;
  defaultPhone?: string;
  defaultAddress?: string;
  products: SellableVariant[];
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
    { key: "line-1", variantId: products[0]?.id ?? "", qty: 1 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const phoneId = "create-order-phone";
  const addressId = "create-order-address";
  const errorId = "create-order-error";

  const total = useMemo(() => {
    return lines.reduce((sum, line) => {
      const variant = products.find((item) => item.id === line.variantId);
      if (!variant || line.qty < 1) return sum;
      return sum + variant.price * line.qty;
    }, 0);
  }, [lines, products]);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  function addLine() {
    setLines((current) => [
      ...current,
      {
        key: `line-${current.length + 1}-${crypto.randomUUID()}`,
        variantId: products[0]?.id ?? "",
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
          items: lines.map((line) => ({ variantId: line.variantId, qty: line.qty })),
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
    <div className="mt-4 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-slate-900">Tạo đơn — {customerName}</p>
      <p className="mt-1 text-xs text-slate-500">Chọn biến thể (size/màu) đang bán từ kho.</p>

      {error ? (
        <p
          ref={errorRef}
          id={errorId}
          role="alert"
          tabIndex={-1}
          className="alert-error mt-3 text-xs outline-none"
        >
          {error}
        </p>
      ) : null}

      <label className="mt-3 block text-xs" htmlFor={phoneId}>
        <span className="label">SĐT</span>
        <input
          id={phoneId}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          aria-invalid={error?.includes("điện thoại") ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="input-field-sm min-h-11"
        />
      </label>
      <label className="mt-2 block text-xs" htmlFor={addressId}>
        <span className="label">Địa chỉ *</span>
        <textarea
          id={addressId}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          rows={2}
          maxLength={CUSTOMER_ADDRESS_MAX}
          required
          aria-invalid={error?.includes("địa chỉ") || error?.includes("Địa chỉ") ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="input-field-sm min-h-20 resize-y"
        />
      </label>

      <div className="mt-3 space-y-2">
        {lines.map((line, index) => (
          <div key={line.key} className="grid grid-cols-[1fr_5rem] gap-2">
            <label className="text-xs">
              <span className="sr-only">Biến thể dòng {index + 1}</span>
              <select
                value={line.variantId}
                onChange={(event) => {
                  const variantId = event.target.value;
                  setLines((current) =>
                    current.map((row) => (row.key === line.key ? { ...row, variantId } : row)),
                  );
                }}
                className="input-field-sm min-h-11"
              >
                {products.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label} · {formatMoney(variant.price)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="sr-only">Số lượng dòng {index + 1}</span>
              <input
                type="number"
                min={1}
                max={ORDER_ITEM_QTY_MAX}
                value={line.qty}
                onChange={(event) => {
                  const qty = Math.min(ORDER_ITEM_QTY_MAX, Math.max(1, Number(event.target.value) || 1));
                  setLines((current) =>
                    current.map((row) => (row.key === line.key ? { ...row, qty } : row)),
                  );
                }}
                className="input-field-sm min-h-11"
              />
            </label>
          </div>
        ))}
        <button type="button" onClick={addLine} className="btn-ghost min-h-9 text-xs">
          + Thêm dòng
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-slate-500">Tổng</span>
        <span className="text-base font-semibold text-slate-900">{formatMoney(total)}</span>
      </div>

      {products.length === 0 ? (
        <p className="mt-3 text-xs text-amber-800">
          Chưa có biến thể đang bán. Thêm ở{" "}
          <Link href="/products" className="font-semibold underline">
            Sản phẩm
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={isPending || products.length === 0}
          onClick={submit}
          aria-busy={isPending}
          className="btn-primary flex-1"
        >
          {isPending ? "Đang lưu…" : "Lưu đơn"}
        </button>
        <button type="button" onClick={onClose} className="btn-secondary shrink-0">
          Hủy
        </button>
      </div>
    </div>
  );
}
