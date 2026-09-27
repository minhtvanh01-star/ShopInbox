"use client";

import { useState, useTransition } from "react";
import { updateCustomerProfile } from "@/app/(app)/actions";
import {
  CUSTOMER_ADDRESS_MAX,
  CUSTOMER_NOTE_MAX,
  customerProfileChecklist,
} from "@/lib/customer-profile";
import type { Customer } from "@/lib/types";

type CustomerProfileFormProps = {
  customer: Customer;
  onSaved: (patch: Pick<Customer, "phone" | "address" | "note">) => void;
};

export function CustomerProfileForm({ customer, onSaved }: CustomerProfileFormProps) {
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [note, setNote] = useState(customer.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateCustomerProfile({
        customerId: customer.id,
        phone,
        address,
        note,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved(result.customer);
      setSaved(true);
    });
  }

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="field-group">
        <label htmlFor={`customer-phone-${customer.id}`} className="label mb-0">
          Số điện thoại
        </label>
        <input
          id={`customer-phone-${customer.id}`}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="0901 234 567"
          className="input-field-sm"
        />
      </div>
      <div className="field-group">
        <label htmlFor={`customer-address-${customer.id}`} className="label mb-0">
          Địa chỉ
        </label>
        <input
          id={`customer-address-${customer.id}`}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          maxLength={CUSTOMER_ADDRESS_MAX}
          placeholder="Số nhà, quận/huyện"
          className="input-field-sm"
        />
      </div>
      <div className="field-group">
        <label htmlFor={`customer-note-${customer.id}`} className="label mb-0">
          Ghi chú
        </label>
        <textarea
          id={`customer-note-${customer.id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={CUSTOMER_NOTE_MAX}
          rows={3}
          placeholder="Size, sở thích, lưu ý giao hàng…"
          className="input-field-sm min-h-20 resize-y py-2"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2"
        >
          <span className="text-xs font-semibold text-teal-800">Đã lưu</span>
          {customerProfileChecklist({ phone, address, note }).map((item) => (
            <span
              key={item.id}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                item.done
                  ? "bg-white text-teal-800 ring-1 ring-teal-200"
                  : "bg-white/70 text-slate-500 ring-1 ring-border"
              }`}
            >
              <span aria-hidden="true">{item.done ? "✓" : "○"}</span>
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
      <button type="submit" disabled={pending} className="btn-secondary w-full min-h-11">
        {pending ? "Đang lưu…" : "Lưu hồ sơ"}
      </button>
    </form>
  );
}
