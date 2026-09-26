"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  toggleShopSuspendedAction,
  toggleSuperAdminAction,
  updateShopOpsAction,
  type PlatformShopActionState,
} from "@/app/(app)/admin/shops/actions";
import { roleLabel } from "@/lib/rbac-catalog";
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto bg-[linear-gradient(180deg,#f0fdfa_0%,#e8f1f4_100%)] p-6">
      <p>
        <Link href="/admin/shops" className="text-sm font-medium text-teal-800 hover:underline">
          ← Tất cả shop
        </Link>
      </p>

      {suspendState.error || grantState.error || opsState.error ? (
        <p role="alert" className="alert-error">
          {suspendState.error || grantState.error || opsState.error}
        </p>
      ) : null}
      {suspendState.success || grantState.success || opsState.success ? (
        <p role="status" className="alert-success">
          {suspendState.success || grantState.success || opsState.success}
        </p>
      ) : null}

      <section className="card-padded">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-teal-950">{name}</h2>
            <p className="mt-1 text-sm text-slate-500">Tạo {createdAt}</p>
            <p className="mt-2 text-sm text-slate-600">
              {counts.staff} nhân viên · {counts.customers} khách · {counts.orders} đơn ·{" "}
              {counts.conversations} hội thoại
              {setupDone ? "" : " · chưa cấu hình xong"}
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
        <h3 className="text-sm font-semibold text-slate-900">Kênh</h3>
        {channels.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Chưa kết nối kênh.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {channels.map((channel) => (
              <li key={channel.id} className="flex justify-between py-2 text-sm">
                <span>{channel.label}</span>
                <span className="text-slate-500">{channel.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-padded">
        <h3 className="text-sm font-semibold text-slate-900">Thành viên</h3>
        <ul className="mt-3 divide-y divide-border">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-slate-900">
                  {member.name}
                  {member.isSuperAdmin ? (
                    <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800 ring-1 ring-violet-200">
                      Super admin
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-500">
                  {member.email} · {roleLabel(member.roleCode)}
                  {member.isActive ? "" : " · chờ / tắt"}
                </p>
              </div>
              <form action={grantAction}>
                <input type="hidden" name="staffId" value={member.id} />
                <input type="hidden" name="grant" value={member.isSuperAdmin ? "0" : "1"} />
                <button
                  type="submit"
                  disabled={grantPending}
                  className="text-xs font-semibold text-teal-800 hover:underline"
                >
                  {member.isSuperAdmin ? "Gỡ Super admin" : "Gán Super admin"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
