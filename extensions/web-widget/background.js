const KEY_PREFIX = "siwk_";

function parseOrigin(raw) {
  try {
    const origin = new URL(String(raw || "").trim()).origin;
    if (!origin.startsWith("http://") && !origin.startsWith("https://")) return null;
    return origin;
  } catch {
    return null;
  }
}

function isPair(value) {
  if (!value || typeof value !== "object") return false;
  const appOrigin = parseOrigin(value.appOrigin);
  const widgetKey = String(value.widgetKey || "").trim();
  const websiteHost = String(value.websiteHost || "").trim().toLowerCase();
  if (!appOrigin) return false;
  if (!widgetKey.startsWith(KEY_PREFIX) || widgetKey.length < 12) return false;
  if (!websiteHost || websiteHost.includes("/")) return false;
  return true;
}

function isPopupSender(sender) {
  if (!sender || sender.id !== chrome.runtime.id) return false;
  const popup = chrome.runtime.getURL("popup.html");
  const url = String(sender.url || "").split("#")[0].split("?")[0];
  return url === popup;
}

function storedAppOrigin(data) {
  return parseOrigin(data.appOrigin) || parseOrigin(data.pair?.appOrigin);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "setOrigin") {
    if (!isPopupSender(sender)) {
      sendResponse({ ok: false });
      return false;
    }
    const origin = parseOrigin(message.origin);
    const tabOrigin = parseOrigin(message.tabOrigin);
    if (!origin || origin !== tabOrigin) {
      sendResponse({ ok: false });
      return false;
    }
    chrome.storage.local.get("pair", (data) => {
      const finish = () => chrome.storage.local.set({ appOrigin: origin }, () => sendResponse({ ok: true, origin }));
      if (data.pair && parseOrigin(data.pair.appOrigin) !== origin) {
        chrome.storage.local.remove("pair", finish);
        return;
      }
      finish();
    });
    return true;
  }
  if (message?.type === "getOrigin") {
    chrome.storage.local.get(["appOrigin", "pair"], (data) => {
      sendResponse(storedAppOrigin(data));
    });
    return true;
  }
  if (message?.type === "pair") {
    if (!isPopupSender(sender) || !isPair(message.payload)) {
      sendResponse({ ok: false });
      return false;
    }
    const origin = parseOrigin(message.payload.appOrigin);
    const tabOrigin = parseOrigin(message.tabOrigin);
    if (!origin || tabOrigin !== origin) {
      sendResponse({ ok: false });
      return false;
    }
    const payload = {
      appOrigin: origin,
      widgetKey: String(message.payload.widgetKey).trim(),
      websiteHost: String(message.payload.websiteHost).trim().toLowerCase(),
    };
    chrome.storage.local.set({ pair: payload, appOrigin: origin }, () => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "getPair") {
    chrome.storage.local.get("pair", (data) => sendResponse(data.pair ?? null));
    return true;
  }
  return false;
});
