const statusEl = document.getElementById("status");
const openInboxBtn = document.getElementById("openInbox");
const attachOriginBtn = document.getElementById("attachOrigin");
const confirmBtn = document.getElementById("confirm");
const connectBtn = document.getElementById("connect");
const injectBtn = document.getElementById("inject");
const copyBtn = document.getElementById("copy");

const ORIGIN_ATTR = "data-nexo-app-origin";
const PAIR_ATTR = "data-shopinbox-widget-pair";
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

function readAttr(tab, name) {
  return new Promise((resolve) => {
    if (!tab?.id || !/^https?:/.test(tab.url || "")) {
      resolve(null);
      return;
    }
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: (attr) => document.documentElement.getAttribute(attr),
        args: [name],
      },
      (results) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(results?.[0]?.result ?? null);
      },
    );
  });
}

function parseWidgetOffer(tabUrl, raw) {
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

function inboxUrl(origin) {
  try {
    return new URL("/inbox", origin).toString();
  } catch {
    return "";
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
  const tabHost = hostOf(tab?.url || "");
  const [originMark, pairRaw] = await Promise.all([readAttr(tab, ORIGIN_ATTR), readAttr(tab, PAIR_ATTR)]);
  const originOffer =
    originOf(tab?.url) && originOf(originMark) === originOf(tab?.url) ? originOf(tab.url) : null;
  const widgetOffer = parseWidgetOffer(tab?.url, pairRaw);

  chrome.runtime.sendMessage({ type: "getOrigin" }, (appOrigin) => {
    chrome.runtime.sendMessage({ type: "getPair" }, (pair) => {
      const origin = appOrigin || pair?.appOrigin || null;

      openInboxBtn.addEventListener("click", () => {
        if (!origin) {
          setStatus("Mở Nexo trên tab, bấm Gắn tab Nexo này, rồi Mở Inbox.", "warn");
          return;
        }
        chrome.tabs.create({ url: inboxUrl(origin) });
      });

      if (originOffer) {
        attachOriginBtn.hidden = false;
        attachOriginBtn.addEventListener("click", () => {
          chrome.runtime.sendMessage(
            { type: "setOrigin", origin: originOffer, tabOrigin: originOf(tab.url) },
            (res) => {
              if (res?.ok) {
                setStatus(`Đã gắn ${originOffer}. Bấm Mở Inbox lần sau.`, "ok");
                attachOriginBtn.disabled = true;
              } else {
                setStatus("Không gắn được. Mở đúng tab Nexo.", "warn");
              }
            },
          );
        });
      }

      if (widgetOffer) {
        confirmBtn.hidden = false;
        confirmBtn.addEventListener("click", () => {
          chrome.runtime.sendMessage(
            { type: "pair", payload: widgetOffer, tabOrigin: originOf(tab.url) },
            (res) => {
              if (res?.ok) {
                setStatus(
                  `Đã gắn chat ${widgetOffer.websiteHost}. Mở website shop rồi Hiện nút Chat.`,
                  "ok",
                );
                confirmBtn.disabled = true;
              } else {
                setStatus("Không gắn chat website. Mở đúng Cài đặt Nexo.", "warn");
              }
            },
          );
        });
      }

      if (originOffer && !origin) {
        setStatus(`Tab Nexo: ${originOffer}. Bấm Gắn tab Nexo này.`, "warn");
      } else if (origin) {
        setStatus(`Inbox: ${origin}.`, "ok");
      } else if (!tabHost) {
        setStatus("Mở Nexo trên Chrome rồi bấm icon.", "warn");
      } else {
        setStatus(`Trang: ${tabHost}. Mở Nexo, bấm icon, Gắn tab Nexo này.`, "warn");
      }

      if (widgetOffer) return;

      connectBtn.hidden = false;
      connectBtn.addEventListener("click", () => {
        const connected = origin || pair?.appOrigin;
        if (!connected) {
          setStatus("Gắn tab Nexo trước, rồi nối domain website.", "warn");
          return;
        }
        const url = new URL("/settings", connected);
        url.searchParams.set("connect", "web");
        url.searchParams.set("web_host", tabHost || "");
        chrome.tabs.create({ url: url.toString() });
      });

      if (!pair) return;

      copyBtn.hidden = false;
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(snippet(pair));
          setStatus("Đã copy snippet. Dán trước </body> trên site thật.", "ok");
        } catch {
          setStatus("Không copy được. Copy snippet trên Cài đặt.", "warn");
        }
      });

      if (!tabHost || tabHost !== pair.websiteHost) {
        if (pair.websiteHost && tabHost && tabHost !== pair.websiteHost) {
          setStatus(
            `Trang đang mở là ${tabHost}, shop đã nối ${pair.websiteHost}. Nối đúng domain rồi gửi lại tiện ích.`,
            "warn",
          );
        }
        return;
      }

      injectBtn.hidden = false;
      setStatus(`Inbox ${origin || pair.appOrigin}. Hiện thử chat trên ${pair.websiteHost}.`, "ok");
      injectBtn.addEventListener("click", () => {
        if (!tab.id) return;
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            func: (appOriginValue, key) => {
              if (document.querySelector("[data-shopinbox-widget]")) {
                return { already: true };
              }
              const script = document.createElement("script");
              script.src = `${String(appOriginValue).replace(/\/$/, "")}/widget.js`;
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
});
