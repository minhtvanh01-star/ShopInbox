/** Layout dimensions — single source for sidebar & inbox panels */
export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 56;
export const INBOX_LIST_MIN = 240;
export const INBOX_LIST_MAX = 420;
export const INBOX_LIST_DEFAULT = 300;
export const INBOX_LIST_COLLAPSED = 72;
export const INBOX_PANEL_MIN = 240;
export const INBOX_PANEL_MAX = 300;
export const MODAL_SIDEBAR_WIDTH = 280;
export const CHAT_BUBBLE_MAX = "78%";

/** Tailwind breakpoints used for responsive layout */
export const BREAKPOINTS = {
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export const STORAGE_KEYS = {
  sidebarCollapsed: "shopinbox.sidebar.collapsed",
  inboxCustomerPanel: "shopinbox.inbox.customerPanel",
  inboxListWidth: "shopinbox.inbox.listWidth",
  inboxListCollapsed: "shopinbox.inbox.listCollapsed",
  settingsDevUrlsOpen: "shopinbox.settings.devUrlsOpen",
} as const;

/** Tailwind classes referencing CSS vars from globals.css */
export const LAYOUT_CLASS = {
  sidebar: "w-[var(--sidebar-width)]",
  sidebarCollapsed: "w-[var(--sidebar-collapsed-width)]",
  inboxList:
    "min-w-[var(--inbox-list-min)] max-w-[var(--inbox-list-max)] shrink-0 basis-[var(--inbox-list-default)]",
  inboxPanel:
    "min-w-[var(--inbox-panel-min)] max-w-[var(--inbox-panel-max)] shrink-0 basis-[var(--inbox-panel-max)]",
  modalSidebar: "w-[var(--modal-sidebar-width)]",
} as const;

export function clampInboxListWidth(width: number) {
  if (!Number.isFinite(width)) return INBOX_LIST_DEFAULT;
  return Math.min(INBOX_LIST_MAX, Math.max(INBOX_LIST_MIN, Math.round(width)));
}
