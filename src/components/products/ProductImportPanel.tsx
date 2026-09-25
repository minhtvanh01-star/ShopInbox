"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  importProductVariantsAction,
  type ProductFormState,
} from "@/app/(app)/products/actions";
import { MAX_UPLOAD_MB, validateSpreadsheetFileForUpload } from "@/lib/inbox-media";
import { VARIANT_IMPORT_HEADERS } from "@/lib/product-import";

const empty: ProductFormState = {};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProductImportPanel({
  productId,
  productCode,
  productName,
  onDone,
}: {
  productId: string;
  productCode: string;
  productName: string;
  onDone: (result: ProductFormState) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const fileHintId = "product-import-hint";
  const fileErrorId = "product-import-error";
  const [selected, setSelected] = useState<{ name: string; size: number } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(
    async (prev: ProductFormState, formData: FormData) => {
      const file = formData.get("file");
      if (file instanceof File) {
        const check = validateSpreadsheetFileForUpload({
          type: file.type,
          size: file.size,
          name: file.name,
        });
        if (!check.ok) {
          return { error: check.error };
        }
      }
      formData.set("productId", productId);
      const result = await importProductVariantsAction(prev, formData);
      if (result.success) {
        formRef.current?.reset();
        setSelected(null);
        setLocalError(null);
        onDone(result);
      }
      return result;
    },
    empty,
  );

  const error = localError || state.error;

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  return (
    <div className="card-padded space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          Nhập biến thể cho «{productName}» ({productCode})
        </p>
        <p id={fileHintId} className="mt-1 text-xs leading-5 text-slate-500">
          Tạo sản phẩm trước, rồi nhập Excel chỉ chứa biến thể. Cột:{" "}
          {VARIANT_IMPORT_HEADERS.join(", ")}. Chỉ nhận .xlsx / .xls, tối đa {MAX_UPLOAD_MB}MB.
          Khớp theo SKU (ưu tiên) hoặc tên — biến thể cũ không có trong file vẫn được giữ.
        </p>
      </div>

      <a
        href="/api/products/import-template"
        className="btn-secondary inline-flex min-h-10 text-xs"
      >
        Tải file mẫu biến thể
      </a>

      <form ref={formRef} action={action} className="space-y-3">
        {error ? (
          <p
            ref={errorRef}
            id={fileErrorId}
            role="alert"
            tabIndex={-1}
            className="alert-error outline-none"
          >
            {error}
          </p>
        ) : null}
        <input type="hidden" name="productId" value={productId} />
        <label className="block text-xs" htmlFor="product-import-file">
          <span className="label">Chọn file (.xlsx / .xls)</span>
          <input
            id="product-import-file"
            type="file"
            name="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            required
            aria-describedby={error ? `${fileHintId} ${fileErrorId}` : fileHintId}
            aria-invalid={error ? true : undefined}
            className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-teal-800"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setLocalError(null);
              if (!file) {
                setSelected(null);
                return;
              }
              const check = validateSpreadsheetFileForUpload({
                type: file.type,
                size: file.size,
                name: file.name,
              });
              if (!check.ok) {
                setSelected(null);
                setLocalError(check.error);
                event.target.value = "";
                return;
              }
              setSelected({ name: file.name, size: file.size });
            }}
          />
        </label>
        {selected ? (
          <p className="text-xs text-slate-600" aria-live="polite">
            Đã chọn <span className="font-medium text-slate-800">{selected.name}</span> (
            {formatFileSize(selected.size)})
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="btn-primary min-h-11"
          aria-busy={pending}
        >
          {pending ? "Đang nhập… có thể mất vài giây với file lớn" : "Nhập biến thể"}
        </button>
      </form>

      {state.success ? (
        <p role="status" className="alert-success">
          {state.success}
        </p>
      ) : null}
    </div>
  );
}
