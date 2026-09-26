"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { fetchInboxNoticesAction } from "@/app/(app)/inbox-notices";
import { logoutAction } from "@/app/login/actions";
import { CHANNEL_LABEL, formatTime } from "@/lib/labels";
import type { InboxNoticeItem, InboxNoticeSummary } from "@/lib/inbox-notices";
import { INBOX_NOTICES_REFRESH_EVENT } from "@/lib/inbox-notices";
import { LAYOUT_CLASS, STORAGE_KEYS } from "@/lib/ui-layout";
import { usePersistedState } from "@/lib/use-persisted-state";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";

type NavItem = {
  href: string;
  label: string;
  icon: () => React.JSX.Element;
  permission?: string;
  anyPermission?: string[];
  superAdminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/admin/shops", label: "Quản lý shop", icon: AdminIcon, superAdminOnly: true },
  { href: "/inbox", label: "Inbox", icon: InboxIcon, permission: PERMISSION_CODES.inboxRead },
  { href: "/orders", label: "Đơn hàng", icon: OrderIcon, permission: PERMISSION_CODES.ordersRead },
  { href: "/products", label: "Sản phẩm", icon: ProductIcon, permission: PERMISSION_CODES.ordersRead },
  { href: "/customers", label: "Khách", icon: CustomerIcon, permission: PERMISSION_CODES.customersRead },
  { href: "/staff", label: "Nhân viên", icon: StaffIcon, permission: PERMISSION_CODES.staffRead },
  { href: "/audit", label: "Nhật ký hoạt động", icon: AuditIcon, permission: PERMISSION_CODES.auditRead },
  {
    href: "/settings",
    label: "Cài đặt kênh",
    icon: GearIcon,
    anyPermission: [PERMISSION_CODES.settingsUpdate, PERMISSION_CODES.channelsConnect],
  },
  { href: "/settings/profile", label: "Hồ sơ cá nhân", icon: ProfileIcon, permission: PERMISSION_CODES.profileUpdate },
];

const NOTICE_POLL_MS = 20_000;

type SidebarProps = {
  shopName: string;
  staffName: string;
  roleLabel: string;
  permissions: string[];
  isSuperAdmin?: boolean;
  inboxNotices: InboxNoticeSummary;
};

export function Sidebar({
  shopName,
  staffName,
  roleLabel,
  permissions,
  isSuperAdmin = false,
  inboxNotices,
}: SidebarProps) {
  const pathname = usePathname();
  const items = NAV.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.anyPermission?.length) {
      return item.anyPermission.some((code) => permissions.includes(code));
    }
    return !item.permission || permissions.includes(item.permission);
  });
  const [collapsed, setCollapsed] = usePersistedState(STORAGE_KEYS.sidebarCollapsed, false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [summary, setSummary] = useState(inboxNotices);
  const [prevInboxNotices, setPrevInboxNotices] = useState(inboxNotices);
  if (inboxNotices !== prevInboxNotices) {
    setPrevInboxNotices(inboxNotices);
    setSummary(inboxNotices);
  }
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setNoticesOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setNoticesOpen(false);
      }
    }
    if (!noticesOpen) {
      return;
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [noticesOpen]);

  useEffect(() => {
    if (!permissions.includes(PERMISSION_CODES.inboxRead)) {
      return;
    }
    const refresh = () => {
      startTransition(async () => {
        try {
          const next = await fetchInboxNoticesAction();
          setSummary(next);
        } catch {
          // bỏ qua lỗi poll
        }
      });
    };
    const timer = window.setInterval(refresh, NOTICE_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    window.addEventListener(INBOX_NOTICES_REFRESH_EVENT, refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(INBOX_NOTICES_REFRESH_EVENT, refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [permissions, startTransition]);

  const iconOnly = collapsed;
  const unreadBadge =
    summary.unreadTotal > 99 ? "99+" : summary.unreadTotal > 0 ? String(summary.unreadTotal) : null;
  // Khớp prefix dài nhất — tránh `/settings/profile` sáng cả `/settings`.
  const activeHref = items
    .filter(
      (candidate) =>
        pathname === candidate.href || pathname.startsWith(`${candidate.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      <button
        type="button"
        aria-label="Mở menu"
        onClick={() => setMobileOpen(true)}
        className="icon-btn fixed left-3 top-3 z-40 bg-surface shadow-sm ring-1 ring-border md:hidden"
      >
        <MenuIcon />
      </button>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Đóng menu"
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px] transition-opacity duration-150 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface/95 shadow-lg backdrop-blur-sm transition-[width,transform] duration-200 ease-out md:static md:z-auto md:bg-surface md:shadow-none md:backdrop-blur-none ${
          iconOnly ? LAYOUT_CLASS.sidebarCollapsed : LAYOUT_CLASS.sidebar
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div
          className={`flex items-center border-b border-border py-4 ${iconOnly ? "flex-col gap-2 px-2" : "gap-3 px-4"}`}
        >
          <div className="brand-mark h-9 w-9 text-sm" aria-hidden="true">
            S
          </div>
          {!iconOnly ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight text-teal-950">ShopInbox</p>
              <p className="truncate text-xs text-slate-500">{shopName}</p>
            </div>
          ) : null}

          {permissions.includes(PERMISSION_CODES.inboxRead) ? (
            <div className="relative" ref={panelRef}>
              <button
                type="button"
                aria-label="Thông báo inbox"
                aria-expanded={noticesOpen}
                title="Thông báo"
                onClick={() => setNoticesOpen((open) => !open)}
                className="group relative icon-btn shrink-0"
              >
                <BellIcon />
                {unreadBadge ? (
                  <span
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] font-bold text-white"
                  >
                    <span className="sr-only">{summary.unreadTotal} tin chưa đọc</span>
                    <span aria-hidden="true">{unreadBadge}</span>
                  </span>
                ) : null}
                {iconOnly ? (
                  <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                    Thông báo
                  </span>
                ) : null}
              </button>
              {noticesOpen ? (
                <div
                  className={`absolute z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-elevated ${
                    iconOnly ? "left-0" : "right-0"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                    <p className="text-sm font-semibold text-slate-900">Thông báo</p>
                    <span className="text-[11px] text-slate-500">
                      {pending ? "Đang cập nhật…" : `${summary.unreadConversations} hội thoại`}
                    </span>
                  </div>
                  <ul className="max-h-80 overflow-y-auto">
                    {summary.notices.length === 0 ? (
                      <li className="px-3 py-8 text-center text-sm text-slate-500">
                        Không có tin chưa đọc
                      </li>
                    ) : (
                      summary.notices.map((item) => (
                        <li key={item.conversationId} className="border-b border-border last:border-b-0">
                          <Link
                            href={`/inbox?c=${encodeURIComponent(item.conversationId)}`}
                            onClick={() => {
                              setNoticesOpen(false);
                              setMobileOpen(false);
                            }}
                            className="block px-3 py-2.5 transition-colors hover:bg-surface-muted"
                          >
                            <NoticeRow item={item} />
                          </Link>
                        </li>
                      ))
                    )}
                  </ul>
                  <div className="border-t border-border px-3 py-2">
                    <Link
                      href="/inbox"
                      onClick={() => {
                        setNoticesOpen(false);
                        setMobileOpen(false);
                      }}
                      className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline"
                    >
                      Mở Inbox
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!iconOnly ? (
            <button
              type="button"
              aria-label="Thu gọn sidebar"
              title="Thu gọn"
              onClick={() => setCollapsed(true)}
              className="icon-btn hidden shrink-0 md:inline-flex"
            >
              <ChevronLeftIcon />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Mở rộng sidebar"
              title="Mở rộng"
              onClick={() => setCollapsed(false)}
              className="icon-btn hidden shrink-0 md:inline-flex"
            >
              <ChevronRightIcon />
            </button>
          )}
          {/* Chỉ hiện khi drawer mobile mở — desktop thu gọn dùng nút mở rộng ở trên */}
          <button
            type="button"
            aria-label="Đóng menu"
            title="Đóng menu"
            onClick={() => setMobileOpen(false)}
            className="icon-btn shrink-0 md:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className={`flex flex-1 flex-col gap-1 py-4 ${iconOnly ? "px-2" : "px-3"}`}>
          {items.map((item) => {
            const active = item.href === activeHref;
            const showInboxBadge = item.href === "/inbox" && unreadBadge;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-label={
                  showInboxBadge
                    ? `${item.label}, ${summary.unreadTotal} tin chưa đọc`
                    : item.label
                }
                aria-current={active ? "page" : undefined}
                title={item.label}
                className={`group relative flex cursor-pointer items-center rounded-lg text-sm font-medium transition-colors duration-200 ${
                  iconOnly ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
                } ${
                  active
                    ? "bg-teal-50 text-teal-900 shadow-sm ring-1 ring-teal-200/80"
                    : "text-slate-600 hover:bg-surface-muted hover:text-slate-900"
                }`}
              >
                {active && !iconOnly ? (
                  <span
                    className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-teal-600"
                    aria-hidden="true"
                  />
                ) : null}
                <span className={`relative ${active ? "text-teal-600" : "text-slate-400"}`}>
                  <item.icon />
                  {iconOnly && showInboxBadge ? (
                    <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-orange-500" />
                  ) : null}
                </span>
                {!iconOnly ? (
                  <>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {showInboxBadge ? (
                      <span
                        className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1.5 text-[10px] font-bold text-white"
                        aria-hidden="true"
                      >
                        {unreadBadge}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-border py-4 ${iconOnly ? "px-2" : "px-4"}`}>
          {!iconOnly ? (
            <div className="rounded-xl border border-border bg-accent-muted/60 px-3 py-2.5">
              <p className="truncate text-sm font-medium text-teal-950">{staffName}</p>
              <p className="text-xs text-slate-500">{roleLabel}</p>
            </div>
          ) : null}
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Đăng xuất"
              title="Đăng xuất"
              className={`group relative btn-ghost mt-2 text-xs ${
                iconOnly ? "w-full justify-center px-0" : "w-full justify-start px-2"
              }`}
            >
              {iconOnly ? <LogoutIcon /> : "Đăng xuất"}
              {iconOnly ? (
                <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                  Đăng xuất
                </span>
              ) : null}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function NoticeRow({ item }: { item: InboxNoticeItem }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-semibold text-slate-900">{item.customerName}</p>
        <span className="shrink-0 text-[11px] text-slate-400">{formatTime(item.lastAt)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[11px] text-slate-500">{CHANNEL_LABEL[item.channel]}</span>
        {item.replyActive ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
            <span className="activity-dot activity-dot-other" aria-hidden />
            {item.replyStaffName ?? "Đang trả lời"}
          </span>
        ) : null}
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1.5 text-[10px] font-bold text-white">
          {item.unread}
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-slate-500">{item.preview || "Tin mới"}</p>
    </>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function OrderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2h12l3 7H3l3-7z" />
      <path d="M3 9v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" />
      <path d="M9 13h6" />
    </svg>
  );
}

function ProductIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function CustomerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
      <path d="M16 11h4" />
      <path d="M18 9v4" />
    </svg>
  );
}

function StaffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2.5" />
      <path d="M5.5 17c.8-1.6 2-2.5 3.5-2.5s2.7.9 3.5 2.5" />
      <path d="M14 9h5" />
      <path d="M14 13h5" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 18.5c1.4-2 3.3-3 5.5-3s4.1 1 5.5 3" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}
