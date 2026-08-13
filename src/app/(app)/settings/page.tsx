const CHANNELS = [
  { id: "facebook", name: "Facebook Messenger", status: "Chưa nối", note: "Cần app Meta — làm sau khi duyệt UI" },
  { id: "zalo", name: "Zalo OA", status: "Chưa nối", note: "Cần Official Account — làm sau" },
  { id: "instagram", name: "Instagram DM", status: "Chưa nối", note: "Đi cùng Meta app" },
  { id: "web", name: "Chat website", status: "Sẵn sàng (Lát 4)", note: "Widget sẽ chạy thật, không cần duyệt MXH" },
];

export default function SettingsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Cài đặt kênh</h1>
        <p className="text-sm text-slate-500">Bốn kênh đã có chỗ trên UI. Facebook / Zalo / Instagram chưa nối API thật.</p>
      </header>
      <div className="grid gap-4 p-6 md:grid-cols-2">
        {CHANNELS.map((channel) => (
          <article key={channel.id} className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-slate-900">{channel.name}</h2>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {channel.status}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">{channel.note}</p>
            <button
              type="button"
              disabled
              className="mt-4 h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-400"
            >
              Kết nối (chưa mở)
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
