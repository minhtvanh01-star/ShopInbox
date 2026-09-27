import { auditActionLabel, auditEntityLabel, roleLabel } from "@/lib/rbac-catalog";
import { maskEmailsInValue } from "@/lib/mask-email";

export type AuditRow = {
  id: string;
  createdAt: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
};

function metadataText(metadata: unknown): string | null {
  if (metadata == null) return null;
  try {
    return JSON.stringify(maskEmailsInValue(metadata), null, 2);
  } catch {
    return String(maskEmailsInValue(metadata));
  }
}

/** Nhãn phụ cột Đối tượng — phiên đăng nhập dùng email, không hiện staff id thô. */
function entitySubLabel(row: AuditRow): { text: string; mono: boolean } | null {
  if (row.entityType === "Session") {
    return { text: row.actorEmail ?? "—", mono: false };
  }
  if (!row.entityId) return null;
  return { text: row.entityId, mono: true };
}

export function AuditLogTable({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <p className="text-base font-medium text-slate-700">Chưa có nhật ký</p>
        <p className="mt-1 text-sm text-slate-500">
          Thao tác đăng nhập/đăng xuất, nhận-nhả hội thoại, gửi tin, đơn hàng, kênh sẽ hiện ở đây —
          lọc theo người và hành động để truy vết.
        </p>
      </div>
    );
  }

  return (
    <div className="table-shell overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3.5 font-semibold">Thời gian</th>
            <th className="px-4 py-3.5 font-semibold">Người thao tác</th>
            <th className="px-4 py-3.5 font-semibold">Hành động</th>
            <th className="px-4 py-3.5 font-semibold">Đối tượng</th>
            <th className="px-4 py-3.5 font-semibold">Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const details = metadataText(row.metadata);
            const sub = entitySubLabel(row);
            return (
              <tr
                key={row.id}
                className={`border-t border-border align-top transition hover:bg-teal-50/40 ${
                  index % 2 === 1 ? "bg-surface-muted/50" : "bg-surface"
                }`}
              >
                <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">{row.createdAt}</td>
                <td className="px-4 py-3.5">
                  <p className="font-medium text-slate-900">{row.actorEmail ?? "Hệ thống"}</p>
                  <p className="text-xs text-slate-500">{row.actorRole ? roleLabel(row.actorRole) : "—"}</p>
                </td>
                <td className="px-4 py-3.5 font-medium text-slate-800">{auditActionLabel(row.action)}</td>
                <td className="px-4 py-3.5 text-slate-700">
                  <p>{auditEntityLabel(row.entityType)}</p>
                  {sub ? (
                    <p
                      className={`mt-0.5 max-w-[180px] truncate text-[11px] text-slate-400 ${
                        sub.mono ? "font-mono" : ""
                      }`}
                    >
                      {sub.text}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3.5 text-slate-600">
                  {details ? (
                    <details>
                      <summary className="cursor-pointer text-sm text-teal-800 hover:underline">Xem JSON</summary>
                      <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-900 px-3 py-2 text-[11px] leading-5 text-slate-100">
                        {details}
                      </pre>
                    </details>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
