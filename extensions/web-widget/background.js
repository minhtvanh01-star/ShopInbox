const KEY_PREFIX = "siwk_";

function isPair(value) {
  if (!value || typeof value !== "object") return false;
  const appOrigin = String(value.appOrigin || "").trim();
  const widgetKey = String(value.widgetKey || "").trim();
  const websiteHost = String(value.websiteHost || "").trim().toLowerCase();
  if (!widgetKey.startsWith(KEY_PREFIX) || widgetKey.length < 12) return false;
  if (!websiteHost || websiteHost.includes("/")) return false;
  try {
    const origin = new URL(appOrigin).origin;
    if (!origin.startsWith("http://") && !origin.startsWith("https://")) return false;
  } catch {
    return false;
  }
  return true;
}

function isPopupSender(sender) {
  if (!sender || sender.id !== chrome.runtime.id) return false;
  const popup = chrome.runtime.getURL("popup.html");
  const url = String(sender.url || "").split("#")[0].split("?")[0];
  return url === popup;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "pair") {
    if (!isPopupSender(sender) || !isPair(message.payload)) {
      sendResponse({ ok: false });
      return false;
    }
    const origin = new URL(message.payload.appOrigin).origin;
    const tabOrigin = String(message.tabOrigin || "").trim();
    if (tabOrigin !== origin) {
      sendResponse({ ok: false });
      return false;
    }
    const payload = {
      appOrigin: origin,
      widgetKey: String(message.payload.widgetKey).trim(),
      websiteHost: String(message.payload.websiteHost).trim().toLowerCase(),
    };
    chrome.storage.local.set({ pair: payload }, () => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "getPair") {
    chrome.storage.local.get("pair", (data) => sendResponse(data.pair ?? null));
    return true;
  }
  return false;
});
