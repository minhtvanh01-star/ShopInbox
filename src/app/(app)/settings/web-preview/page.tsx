import Link from "next/link";
import Script from "next/script";
import { redirect } from "next/navigation";
import { requireSession } from "@/backend/auth";
import { hasPermission } from "@/backend/rbac";
import { getChannelAccounts } from "@/lib/queries";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";

export default async function WebWidgetPreviewPage() {
  const session = await requireSession();
  const canConnect = await hasPermission(session, PERMISSION_CODES.channelsConnect);
  if (!canConnect) {
    redirect("/settings");
  }

  const accounts = await getChannelAccounts();
  const web = accounts.find(
    (account) => account.channel === "web" && account.status === "ready" && account.widgetKey,
  );
  if (!web?.widgetKey) {
    redirect("/settings");
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <div>
        <Link href="/settings" className="text-sm font-medium text-teal-800 hover:underline">
          ← Cài đặt kênh
        </Link>
        <h1 className="page-title mt-3">Thử chat website</h1>
        <p className="page-subtitle mt-1">
          Nút Chat góc phải dùng cùng widget key với site{" "}
          <span className="font-medium text-slate-800">{web.displayName ?? web.pageId}</span>. Tin vào
          Inbox kênh Web. Khách thật vẫn chat trên website của bạn.
        </p>
      </div>
      <div className="card-padded text-sm leading-6 text-slate-600">
        Trang này chỉ để shop tự nhắn thử. Sau khi dán snippet, bấm Kiểm tra website trên Cài đặt để
        xác nhận HTML site đã có chat.
      </div>
      <Script src="/widget.js" strategy="afterInteractive" data-key={web.widgetKey} />
    </div>
  );
}
