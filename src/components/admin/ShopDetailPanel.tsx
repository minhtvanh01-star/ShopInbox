"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  toggleShopSuspendedAction,
  toggleSuperAdminAction,
  updateShopOpsAction,
  type PlatformShopActionState,
} from "@/app/(app)/admin/shops/actions";
import { StaffAvatar } from "@/components/staff/StaffAvatar";
import { roleLabel } from "@/lib/rbac-catalog";
import { maskEmail } from "@/lib/mask-email";
import {
  SHOP_PLAN_LABEL,
  SHOP_PLANS,
  SHOP_SUPPORT_STATUS_LABEL,
  SHOP_SUPPORT_STATUSES,
  SHOP_SUPPORT_TOPIC_LABEL,
  SHOP_SUPPORT_TOPICS,
  type ShopPlanCode,
  type ShopSupportStatusCode,
  type ShopSupportTopicCode,
} from "@/lib/shop-ops";

const suspendInitial: PlatformShopActionState = {};
const grantInitial: PlatformShopActionState = {};
const opsInitial: PlatformShopActionState = {};

type Member = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  roleCode: string;
  isActive: boolean;
  isSuperAdmin: boolean;
};

type ChannelRow = {
  id: string;
  label: string;
  status: string;
};

export function ShopDetailPanel({
  shopId,
  name,
  suspended,
  setupDone,
  createdAt,
  counts,
  members,
  channels,
  planCode,
  planExpiresInput,
  supportStatus,
  supportTopic,
  supportNote,
}: {
  shopId: string;
  name: string;
  suspended: boolean;
  setupDone: boolean;
  createdAt: string;
  counts: { staff: number; customers: number; orders: number; conversations: number };
  members: Member[];
  channels: ChannelRow[];
  planCode: ShopPlanCode;
  planExpiresInput: string;
  supportStatus: ShopSupportStatusCode;
  supportTopic: ShopSupportTopicCode;
  supportNote: string;
}) {
  const [suspendState, suspendAction, suspendPending] = useActionState(
    toggleShopSuspendedAction,
    suspendInitial,
  );
  const [grantState, grantAction, grantPending] = useActionState(
    toggleSuperAdminAction,
    grantInitial,
  );
  const [opsState, opsAction, opsPending] = useActionState(updateShopOpsAction, opsInitial);
  const flashError = suspendState.error || grantState.error || opsState.error;
  const flashSuccess = suspendState.success || grantState.success || opsState.success;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto bg-[linear-gradient(180deg,#f0fdfa_0%,#e8f1f4_100%)] p-6">
      <p>
        <Link href="/admin/shops" className="text-sm font-medium text-teal-800 hover:underline">
          ← Tất cả shop
        </Link>
      </p>

      {flashError ? (
        <p role="alert" className="alert-error">
          {flashError}
        </p>
      ) : null}
      {flashSuccess ? (
        <p role="status" className="alert-success">
          {flashSuccess}
        </p>
      ) : null}

      <section className="card-padded">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-teal-950">{name}</h2>
            <p className="mt-1 text-sm text-slate-500">Tạo {createdAt}</p>
            <p className="mt-2 text-sm text-slate-600">
              {counts.staff} người dùng · {SHOP_PLAN_LABEL[planCode]} ·{" "}
              {SHOP_SUPPORT_STATUS_LABEL[supportStatus]}
              {setupDone ? "" : " · chưa cấu hình xong"}
              {suspended ? " · đang tạm khóa" : ""}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {counts.customers} khách · {counts.orders} đơn · {counts.conversations} hội thoại
              (thống kê, không mở inbox)
            </p>
          </div>
          <form action={suspendAction}>
            <input type="hidden" name="shopId" value={shopId} />
            <input type="hidden" name="suspend" value={suspended ? "0" : "1"} />
            <button type="submit" disabled={suspendPending} className="btn-primary-sm">
              {suspended ? "Mở lại shop" : "Tạm khóa shop"}
            </button>
          </form>
        </div>
      </section>

      <section className="card-padded overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Người dùng trong shop</h3>
          <p className="mt-1 text-xs text-slate-500">
            Tên, email, vai trò shop. Gán Super admin khi cần quản lý nền tảng.
          </p>
        </div>
        <ul className="divide-y divide-border">
          {members.length === 0 ? (
            <li className="px-5 py-8 text-sm text-slate-500">Chưa có người dùng.</li>
          ) : (
            members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <StaffAvatar name={member.name} avatarUrl={member.avatarUrl} />
                  <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    <span className="mr-2 inline-block max-w-[16rem] truncate align-bottom">
                      {member.name}
                    </span>
                    {member.isSuperAdmin ? (
                      <span className="inline-flex whitespace-nowrap rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800 ring-1 ring-violet-200">
                        Super admin
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {maskEmail(member.email)} · {roleLabel(member.roleCode)}
                    {member.isActive ? "" : " · chờ / tắt"}
                  </p>
                  </div>
                </div>
                <form action={grantAction}>
                  <input type="hidden" name="staffId" value={member.id} />
                  <input type="hidden" name="grant" value={member.isSuperAdmin ? "0" : "1"} />
                  <button
                    type="submit"
                    disabled={grantPending}
                    className="min-h-10 cursor-pointer text-xs font-semibold text-teal-800 hover:underline disabled:cursor-not-allowed"
                  >
                    {member.isSuperAdmin ? "Gỡ Super admin" : "Gán Super admin"}
                  </button>
                </form>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="card-padded">
        <h3 className="text-sm font-semibold text-slate-900">Gói và hỗ trợ</h3>
        <form action={opsAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="shopId" value={shopId} />
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Gói</span>
            <select name="planCode" defaultValue={planCode} className="input-field-sm min-h-11 w-full">
              {SHOP_PLANS.map((code) => (
                <option key={code} value={code}>
                  {SHOP_PLAN_LABEL[code]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Hết hạn gói</span>
            <input
              type="date"
              name="planExpiresAt"
              defaultValue={planExpiresInput}
              className="input-field-sm min-h-11 w-full"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Trạng thái hỗ trợ</span>
            <select
              name="supportStatus"
              defaultValue={supportStatus}
              className="input-field-sm min-h-11 w-full"
            >
              {SHOP_SUPPORT_STATUSES.map((code) => (
                <option key={code} value={code}>
                  {SHOP_SUPPORT_STATUS_LABEL[code]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Nhu cầu</span>
            <select
              name="supportTopic"
              defaultValue={supportTopic}
              className="input-field-sm min-h-11 w-full"
            >
              {SHOP_SUPPORT_TOPICS.map((code) => (
                <option key={code} value={code}>
                  {SHOP_SUPPORT_TOPIC_LABEL[code]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Ghi chú</span>
            <textarea
              name="supportNote"
              defaultValue={supportNote}
              rows={3}
              className="input-field-sm min-h-20 w-full resize-y"
            />
          </label>
          <div>
            <button type="submit" disabled={opsPending} className="btn-primary-sm">
              {opsPending ? "Đang lưu…" : "Lưu gói / hỗ trợ"}
            </button>
          </div>
        </form>
      </section>

      <section className="card-padded">
        <h3 className="text-sm font-semibold text-slate-900">Kênh đã kết nối</h3>
        <p className="mt-1 text-xs text-slate-500">
          Chỉ xem trạng thái kết nối. Super admin không vào hội thoại khách.
        </p>
        {channels.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Chưa kết nối kênh.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {channels.map((channel) => (
              <li key={channel.id} className="flex justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{channel.label}</span>
                <span className="shrink-0 text-slate-500">{channel.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
