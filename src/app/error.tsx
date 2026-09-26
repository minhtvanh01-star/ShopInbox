"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Không tải được trang</h1>
      <p className="max-w-md text-sm leading-6 text-slate-600">
        Máy chủ gặp lỗi sau khi đăng nhập. Bấm tải lại. Nếu vẫn vậy, trên VPS chạy{" "}
        <span className="font-medium">npx prisma migrate deploy</span> rồi restart app.
      </p>
      {error.digest ? <p className="text-xs text-slate-400">Mã lỗi: {error.digest}</p> : null}
      <button type="button" onClick={reset} className="btn-primary min-w-36">
        Tải lại
      </button>
    </div>
  );
}
