import Link from "next/link";
import { SHOP } from "@/lib/mock";

export default function LoginPage() {
  return (
    <main className="flex min-h-full items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-lg font-bold text-white">
            S
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">ShopInbox</h1>
            <p className="text-sm text-slate-500">Inbox đa kênh cho cửa hàng</p>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          Bản Lát 1 dùng cửa hàng mẫu <strong>{SHOP.name}</strong>. Chưa cần mật khẩu
          thật — bấm vào để xem khung 3 cột.
        </p>
        <Link
          href="/inbox"
          className="mt-6 flex h-11 items-center justify-center rounded-lg bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Vào cửa hàng demo
        </Link>
      </div>
    </main>
  );
}
