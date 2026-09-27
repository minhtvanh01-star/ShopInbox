import { redirect } from "next/navigation";
import { prisma } from "@/backend/prisma";
import { requirePermission } from "@/backend/rbac";
import { AuditLogTable, type AuditRow } from "@/components/audit/AuditLogTable";
import { formatDateTimeVN, parseVnDayEnd, parseVnDayStart } from "@/lib/labels";
import { maskEmail, maskEmailsInValue } from "@/lib/mask-email";
import { AUDIT_ACTION_LABEL, canViewAuditLog, PERMISSION_CODES } from "@/lib/rbac-catalog";

type AuditPageProps = {
  searchParams: Promise<{
    actorId?: string;
    action?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const session = await requirePermission(PERMISSION_CODES.auditRead);
  if (!canViewAuditLog(session.role)) {
    redirect("/inbox");
  }
  const params = await searchParams;
  const actorId = params.actorId?.trim() || undefined;
  const action = params.action?.trim() || undefined;
  const from = parseVnDayStart(params.from);
  const to = parseVnDayEnd(params.to);

  const [actors, logs] = await Promise.all([
    prisma.staff.findMany({
      where: { shopId: session.shopId },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.auditLog.findMany({
      where: {
        shopId: session.shopId,
        ...(actorId ? { actorId } : {}),
        ...(action ? { action } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const rows: AuditRow[] = logs.map((log) => ({
    id: log.id,
    createdAt: formatDateTimeVN(log.createdAt),
    actorEmail: log.actorEmail ? maskEmail(log.actorEmail) : null,
    actorRole: log.actorRole,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    metadata: maskEmailsInValue(log.metadata),
  }));

  const actionOptions = Object.entries(AUDIT_ACTION_LABEL).sort((a, b) => a[1].localeCompare(b[1], "vi"));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="page-header">
        <h1 className="page-title">Nhật ký hoạt động</h1>
        <p className="page-subtitle">
          Ai đã làm gì trong shop. Tối đa 200 dòng gần nhất theo bộ lọc.
        </p>
      </header>
      <form className="flex flex-wrap items-end gap-3 border-b border-border bg-surface px-6 py-4">
        <label className="min-w-[160px] flex-1">
          <span className="label">Người thao tác</span>
          <select name="actorId" defaultValue={actorId ?? ""} className="input-field-sm">
            <option value="">Tất cả</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name} ({maskEmail(actor.email)})
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[160px] flex-1">
          <span className="label">Hành động</span>
          <select name="action" defaultValue={action ?? ""} className="input-field-sm">
            <option value="">Tất cả</option>
            {actionOptions.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Từ ngày</span>
          <input type="date" name="from" defaultValue={params.from ?? ""} className="input-field-sm" />
        </label>
        <label>
          <span className="label">Đến ngày</span>
          <input type="date" name="to" defaultValue={params.to ?? ""} className="input-field-sm" />
        </label>
        <button type="submit" className="btn-primary-sm">
          Lọc
        </button>
      </form>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <AuditLogTable rows={rows} />
      </div>
    </div>
  );
}
