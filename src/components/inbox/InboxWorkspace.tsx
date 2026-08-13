"use client";

import { useMemo, useState } from "react";
import { ChannelBadge } from "@/components/ChannelBadge";
import {
  CHANNEL_LABEL,
  TAG_LABEL,
  formatMoney,
  formatTime,
  orderTotal,
} from "@/lib/labels";
import {
  conversations as seedConversations,
  customerById,
  messages as seedMessages,
  ordersByCustomer,
  quickReplies,
} from "@/lib/mock";
import type { Channel, Conversation, Message } from "@/lib/types";

const FILTERS: Array<{ id: "all" | Channel; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "facebook", label: "Facebook" },
  { id: "zalo", label: "Zalo" },
  { id: "instagram", label: "Instagram" },
  { id: "web", label: "Web" },
];

export function InboxWorkspace() {
  const [channel, setChannel] = useState<"all" | Channel>("all");
  const [selectedId, setSelectedId] = useState(seedConversations[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>(seedMessages);
  const [localConversations, setLocalConversations] = useState<Conversation[]>(
    seedConversations,
  );
  const [localSeq, setLocalSeq] = useState(1);

  const visible = useMemo(
    () =>
      localConversations
        .filter((item) => channel === "all" || item.channel === channel)
        .sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt)),
    [channel, localConversations],
  );

  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  const customer = selected ? customerById(selected.customerId) : undefined;
  const thread = selected
    ? localMessages.filter((item) => item.conversationId === selected.id)
    : [];
  const customerOrders = customer ? ordersByCustomer(customer.id) : [];

  function send(text: string) {
    if (!selected || !text.trim()) return;
    const sentAt = new Date().toISOString();
    const message: Message = {
      id: `local-${localSeq}`,
      conversationId: selected.id,
      sender: "shop",
      text: text.trim(),
      createdAt: sentAt,
    };
    setLocalSeq((value) => value + 1);
    setLocalMessages((current) => [...current, message]);
    setLocalConversations((current) =>
      current.map((item) =>
        item.id === selected.id
          ? { ...item, lastMessage: message.text, lastAt: message.createdAt, unread: 0 }
          : item,
      ),
    );
    setDraft("");
  }

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex w-[320px] shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h1 className="text-base font-semibold text-slate-900">Inbox</h1>
          <p className="text-xs text-slate-500">Dữ liệu mẫu — Lát 1</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setChannel(item.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  channel === item.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {visible.map((item) => {
            const person = customerById(item.customerId);
            const active = selected?.id === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left ${
                    active ? "bg-teal-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {person?.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatTime(item.lastAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChannelBadge channel={item.channel} />
                    <span className="text-[11px] text-slate-500">{TAG_LABEL[item.tag]}</span>
                    {item.unread > 0 && (
                      <span className="ml-auto rounded-full bg-teal-500 px-1.5 text-[10px] font-semibold text-white">
                        {item.unread}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">{item.lastMessage}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex min-w-0 flex-1 flex-col bg-slate-50">
        {selected && customer ? (
          <>
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
              <div>
                <p className="font-semibold text-slate-900">{customer.name}</p>
                <p className="text-xs text-slate-500">
                  {CHANNEL_LABEL[selected.channel]} · {TAG_LABEL[selected.tag]}
                </p>
              </div>
            </header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {thread.map((item) => (
                <div
                  key={item.id}
                  className={`flex ${item.sender === "shop" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-6 ${
                      item.sender === "shop"
                        ? "bg-teal-600 text-white"
                        : "bg-white text-slate-800 shadow-sm"
                    }`}
                  >
                    <p>{item.text}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        item.sender === "shop" ? "text-teal-100" : "text-slate-400"
                      }`}
                    >
                      {formatTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <footer className="border-t border-slate-200 bg-white p-4">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {quickReplies.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => send(item.text)}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {item.title}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  send(draft);
                }}
              >
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Nhập tin nhắn..."
                  className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500"
                />
                <button
                  type="submit"
                  className="h-10 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  Gửi
                </button>
              </form>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            Chọn một hội thoại
          </div>
        )}
      </section>

      <aside className="flex w-[300px] shrink-0 flex-col border-l border-slate-200 bg-white">
        {customer ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
            <h2 className="text-sm font-semibold text-slate-900">Khách</h2>
            <p className="mt-3 text-lg font-semibold text-slate-900">{customer.name}</p>
            <p className="mt-1 text-sm text-slate-600">{customer.phone ?? "Chưa có SĐT"}</p>
            <p className="mt-3 text-sm leading-6 text-slate-500">{customer.note}</p>
            <button
              type="button"
              className="mt-5 h-10 rounded-lg bg-slate-900 text-sm font-semibold text-white"
            >
              Tạo đơn
            </button>
            <p className="mt-2 text-[11px] text-slate-400">Form đơn sẽ làm ở Lát 3</p>
            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Đơn gần đây
            </h3>
            <div className="mt-2 space-y-2">
              {customerOrders.length === 0 && (
                <p className="text-sm text-slate-500">Chưa có đơn</p>
              )}
              {customerOrders.map((order) => (
                <div key={order.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">{order.code}</p>
                  <p className="text-xs text-slate-500">
                    {formatMoney(orderTotal(order.items))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
