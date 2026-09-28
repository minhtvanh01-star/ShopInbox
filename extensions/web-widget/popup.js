const statusEl = document.getElementById("status");
const confirmBtn = document.getElementById("confirm");
const connectBtn = document.getElementById("connect");
const injectBtn = document.getElementById("inject");
const copyBtn = document.getElementById("copy");

const ATTR = "data-shopinbox-widget-pair";
const KEY_PREFIX = "siwk_";

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function isSettingsPath(url) {
  try {
    const path = new URL(url).pathname;
    return path === "/settings" || path.startsWith("/settings/");
  } catch {
    return false;
  }
}

function snippet(pair) {
  const src = `${pair.appOrigin.replace(/\/$/, "")}/widget.js`;
  return `<script src="${src}" data-key="${pair.widgetKey}" async></script>`;
}

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = kind || "";
}

function parseOffer(tabUrl, raw) {
  if (!raw || !isSettingsPath(tabUrl)) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const tabOrigin = originOf(tabUrl);
  const appOrigin = originOf(data.appOrigin);
  const widgetKey = String(data.widgetKey || "").trim();
  const websiteHost = String(data.websiteHost || "").trim().toLowerCase();
  if (!tabOrigin || appOrigin !== tabOrigin) return null;
  if (!widgetKey.startsWith(KEY_PREFIX) || widgetKey.length < 12) return null;
  if (!websiteHost || websiteHost.includes("/")) return null;
  return { appOrigin, widgetKey, websiteHost };
}

function readOffer(tab) {
  return new Promise((resolve) => {
    if (!tab?.id || !/^https?:/.test(tab.url || "")) {
      resolve(null);
      return;
    }
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: (name) => document.documentElement.getAttribute(name),
        args: [ATTR],
      },
      (results) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(parseOffer(tab.url, results?.[0]?.result));
      },
    );
  });
}

chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
  const tabHost = hostOf(tab?.url || "");
  if (!tabHost) {
    setStatus("Mở website shop rồi bấm lại.", "warn");
    return;
  }

  const offer = await readOffer(tab);

  chrome.runtime.sendMessage({ type: "getPair" }, (pair) => {
    if (offer) {
      confirmBtn.hidden = false;
      confirmBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage(
          { type: "pair", payload: offer, tabOrigin: originOf(tab.url) },
          (res) => {
            if (res?.ok) {
              setStatus(
                `Đã gắn ${offer.appOrigin} với ${offer.websiteHost}. Mở website shop rồi Hiện nút Chat.`,
                "ok",
              );
              confirmBtn.disabled = true;
            } else {
              setStatus("Không gắn được. Mở đúng tab Cài đặt ShopInbox.", "warn");
            }
          },
        );
      });
      setStatus(`Tab Cài đặt: ${offer.appOrigin}. Gắn với site ${offer.websiteHost}?`, "warn");
    }

    connectBtn.hidden = false;
    connectBtn.addEventListener("click", () => {
      const origin = pair?.appOrigin;
      if (!origin) {
        setStatus("Mở Cài đặt ShopInbox, bấm Gửi sang tiện ích, rồi xác nhận trên icon Nexo.", "warn");
        return;
      }
      const url = new URL("/settings", origin);
      url.searchParams.set("connect", "web");
      url.searchParams.set("web_host", tabHost);
      chrome.tabs.create({ url: url.toString() });
    });

    if (offer) return;

    if (!pair) {
      setStatus(
        `Trang: ${tabHost}. Chưa gắn tiện ích. Cài đặt → Chat website → Gửi sang tiện ích, rồi xác nhận trên icon Nexo.`,
        "warn",
      );
      return;
    }

    copyBtn.hidden = false;
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(snippet(pair));
        setStatus("Đã copy snippet. Dán trước </body> trên site thật.", "ok");
      } catch {
        setStatus("Không copy được. Copy snippet trên Cài đặt.", "warn");
      }
    });

    if (tabHost !== pair.websiteHost) {
      setStatus(
        `Trang đang mở là ${tabHost}, shop đã nối ${pair.websiteHost}. Nối đúng domain rồi gửi lại tiện ích.`,
        "warn",
      );
      return;
    }

    injectBtn.hidden = false;
    setStatus(`Đã gắn ${pair.websiteHost}. Hiện thử nút Chat trên tab này.`, "ok");
    injectBtn.addEventListener("click", () => {
      if (!tab.id) return;
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: (appOrigin, key) => {
            if (document.querySelector("[data-shopinbox-widget]")) {
              return { already: true };
            }
            const script = document.createElement("script");
            script.src = `${String(appOrigin).replace(/\/$/, "")}/widget.js`;
            script.async = true;
            script.setAttribute("data-key", key);
            (document.body || document.documentElement).appendChild(script);
            return { already: false };
          },
          args: [pair.appOrigin, pair.widgetKey],
        },
        (results) => {
          const already = results?.[0]?.result?.already;
          setStatus(
            already ? "Trang này đã có nút Chat." : "Đã hiện nút Chat trên tab này. Khách khác cần snippet trong HTML.",
            "ok",
          );
        },
      );
    });
  });
});
