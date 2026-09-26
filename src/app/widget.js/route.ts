import { NextResponse } from "next/server";

/** Widget chat công khai — origin lấy từ URL script để shop chỉ dán 1 thẻ. */
export async function GET() {
  const body = `"use strict";
(function () {
  var script = document.currentScript;
  function boot() {
    if (!script) {
      var nodes = document.getElementsByTagName("script");
      script = nodes[nodes.length - 1] || null;
    }
    if (!script) return;
    var key = script.getAttribute("data-key") || "";
    if (!key) return;
    var origin = new URL(script.src).origin;
    var storageKey = "shopinbox_web_vid";
    var visitorId = localStorage.getItem(storageKey);
    if (!visitorId || !/^si_[A-Za-z0-9_-]{16,64}$/.test(visitorId)) {
      var bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      var bin = String.fromCharCode.apply(null, Array.from(bytes));
      visitorId = "si_" + btoa(bin).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
      localStorage.setItem(storageKey, visitorId);
    }

    var lastShopAt = "";
    var open = false;
    var root = document.createElement("div");
    root.setAttribute("data-shopinbox-widget", "1");
    root.style.cssText = "all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483646;font-family:system-ui,sans-serif;";
    var panel = document.createElement("div");
    panel.hidden = true;
    panel.style.cssText = "width:320px;max-width:calc(100vw - 32px);height:420px;background:#fff;border:1px solid #ccebe3;border-radius:16px;box-shadow:0 16px 32px -8px rgb(19 78 74 / 0.18);display:flex;flex-direction:column;overflow:hidden;margin-bottom:12px;";
    panel.innerHTML = '<div style="padding:12px 14px;background:#0d9488;color:#fff;font-size:14px;font-weight:600;">Chat cửa hàng</div><div data-log style="flex:1;overflow:auto;padding:12px;font-size:14px;color:#134e4a;"></div><form data-form style="display:flex;gap:8px;padding:10px;border-top:1px solid #ccebe3;"><input data-input type="text" maxlength="2000" placeholder="Nhắn tin…" style="flex:1;border:1px solid #ccebe3;border-radius:10px;padding:8px 10px;font-size:14px;"/><button type="submit" style="background:#0d9488;color:#fff;border:0;border-radius:10px;padding:8px 12px;font-weight:600;cursor:pointer;">Gửi</button></form>';
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = "Chat";
    toggle.setAttribute("aria-label", "Mở chat cửa hàng");
    toggle.style.cssText = "background:#0d9488;color:#fff;border:0;border-radius:999px;padding:12px 18px;font-weight:700;cursor:pointer;box-shadow:0 8px 20px rgb(13 148 136 / 0.35);";
    root.appendChild(panel);
    root.appendChild(toggle);
    document.body.appendChild(root);

    var log = panel.querySelector("[data-log]");
    var form = panel.querySelector("[data-form]");
    var input = panel.querySelector("[data-input]");

    function addBubble(text, mine) {
      var row = document.createElement("div");
      row.style.cssText = "margin:0 0 8px;padding:8px 10px;border-radius:12px;max-width:90%;white-space:pre-wrap;" + (mine ? "margin-left:auto;background:#ccfbf1;" : "background:#f0fdfa;");
      row.textContent = text;
      log.appendChild(row);
      log.scrollTop = log.scrollHeight;
    }

    toggle.addEventListener("click", function () {
      open = !open;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      addBubble(text, true);
      fetch(origin + "/api/webhooks/web", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-ShopInbox-Key": key },
        body: JSON.stringify({
          visitorId: visitorId,
          text: text,
          externalMessageId: visitorId + "-" + Date.now()
        })
      }).catch(function () {});
    });

    function poll() {
      var url = origin + "/api/webhooks/web/poll?visitorId=" + encodeURIComponent(visitorId);
      if (lastShopAt) url += "&after=" + encodeURIComponent(lastShopAt);
      fetch(url, { headers: { "X-ShopInbox-Key": key } })
        .then(function (res) { return res.ok ? res.json() : { messages: [] }; })
        .then(function (data) {
          var messages = data.messages || [];
          for (var i = 0; i < messages.length; i++) {
            addBubble(messages[i].text, false);
            if (messages[i].createdAt > lastShopAt) lastShopAt = messages[i].createdAt;
          }
        })
        .catch(function () {});
    }

    poll();
    setInterval(poll, 3000);
  }

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}
