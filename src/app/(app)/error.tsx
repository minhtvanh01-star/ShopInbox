"use client";

export default function AppError({
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
        Đăng nhập được nhưng không mở được dữ liệu. Đăng xuất rồi vào lại. Nếu vẫn vậy, trên VPS
        kiểm tra <span className="font-medium">DATABASE_URL</span> rồi triển khai lại.
      </p>
      {error.message ? (
        <p className="max-w-lg break-words text-xs text-slate-500">{error.message.slice(0, 280)}</p>
      ) : null}
      {error.digest ? <p className="text-xs text-slate-400">Mã lỗi: {error.digest}</p> : null}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn-secondary min-w-36">
          Tải lại
        </button>
        <a href="/login?reason=revoked" className="btn-primary min-w-36">
          Đăng xuất và thử lại
        </a>
      </div>
    </div>
  );
}
