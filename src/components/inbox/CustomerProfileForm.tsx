"use client";

import { useState, useTransition } from "react";
import { updateCustomerProfile } from "@/app/(app)/actions";
import { CUSTOMER_ADDRESS_MAX, CUSTOMER_NOTE_MAX } from "@/lib/customer-profile";
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
        <p role="status" className="text-sm text-teal-800">
          Đã lưu hồ sơ khách.
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="btn-primary-sm w-full">
        {pending ? "Đang lưu…" : "Lưu hồ sơ"}
      </button>
    </form>
  );
}
