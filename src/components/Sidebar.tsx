"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/login/actions";
import { LAYOUT_CLASS, STORAGE_KEYS } from "@/lib/ui-layout";
import { usePersistedState } from "@/lib/use-persisted-state";

type NavItem = {
  href: string;
  label: string;
  icon: () => React.JSX.Element;
  ownerOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/inbox", label: "Inbox", icon: InboxIcon },
  { href: "/orders", label: "Đơn hàng", icon: OrderIcon },
  { href: "/customers", label: "Khách", icon: PeopleIcon },
  { href: "/staff", label: "Nhân viên", icon: PeopleIcon, ownerOnly: true },
  { href: "/settings", label: "Cài đặt", icon: GearIcon },
];

type SidebarProps = {
  shopName: string;
  staffName: string;
  roleLabel: string;
  isOwner: boolean;
};

export function Sidebar({ shopName, staffName, roleLabel, isOwner }: SidebarProps) {
  const pathname = usePathname();
  const items = NAV.filter((item) => !item.ownerOnly || isOwner);
  const [collapsed, setCollapsed] = usePersistedState(STORAGE_KEYS.sidebarCollapsed, false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const iconOnly = collapsed;

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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface shadow-lg transition-[width,transform] duration-200 ease-out md:static md:z-auto md:shadow-none ${
          iconOnly ? LAYOUT_CLASS.sidebarCollapsed : LAYOUT_CLASS.sidebar
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div
          className={`flex items-center border-b border-border py-4 ${iconOnly ? "flex-col gap-2 px-2" : "gap-3 px-4"}`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-sm font-bold text-white shadow-sm">
            S
          </div>
          {!iconOnly ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">ShopInbox</p>
              <p className="truncate text-xs text-slate-500">{shopName}</p>
            </div>
          ) : null}
          {!iconOnly ? (
            <button
              type="button"
              aria-label="Thu gọn sidebar"
              onClick={() => setCollapsed(true)}
              className="icon-btn hidden shrink-0 md:inline-flex"
            >
              <ChevronLeftIcon />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setMobileOpen(false)}
            className={`icon-btn shrink-0 ${iconOnly ? "" : "md:hidden"}`}
          >
            <CloseIcon />
          </button>
        </div>

        <nav className={`flex flex-1 flex-col gap-1 py-4 ${iconOnly ? "px-2" : "px-3"}`}>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={iconOnly ? item.label : undefined}
                className={`flex items-center rounded-lg text-sm font-medium transition-colors duration-150 ${
                  iconOnly ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
                } ${
                  active
                    ? "bg-teal-50 text-teal-800 ring-1 ring-teal-200"
                    : "text-slate-600 hover:bg-surface-muted hover:text-slate-900"
                }`}
              >
                <span className={active ? "text-teal-600" : "text-slate-400"}>
                  <item.icon />
                </span>
                {!iconOnly ? item.label : null}
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-border py-4 ${iconOnly ? "px-2" : "px-4"}`}>
          {!iconOnly ? (
            <div className="rounded-lg bg-surface-muted px-3 py-2.5">
              <p className="truncate text-sm font-medium text-slate-900">{staffName}</p>
              <p className="text-xs text-slate-500">{roleLabel}</p>
            </div>
          ) : (
            <button
              type="button"
              aria-label="Mở rộng sidebar"
              onClick={() => setCollapsed(false)}
              className="icon-btn mx-auto hidden w-full md:flex"
            >
              <ChevronRightIcon />
            </button>
          )}
          <form action={logoutAction}>
            <button
              type="submit"
              title="Đăng xuất"
              className={`btn-ghost mt-2 text-xs ${iconOnly ? "w-full justify-center px-0" : "w-full justify-start px-2"}`}
            >
              {iconOnly ? <LogoutIcon /> : "Đăng xuất"}
            </button>
          </form>
        </div>
      </aside>
    </>
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

function PeopleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
