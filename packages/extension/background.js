// Veritas Stack — Chrome MV3 service worker.
//
// Flow:
//   1. Right-click an image → context menu item "Verify with Veritas Stack"
//   2. Fetch the image bytes (in this service worker — CORS allowed under
//      <all_urls> host permission).
//   3. POST to {API_BASE}/verify as multipart/form-data.
//   4. Base64-encode the resulting Report JSON and open
//      {WEB_BASE}/report?token=... in a new tab.
//
// Defaults assume `apps/api` on :8000 and `apps/web` on :3000. The options
// page lets the user override either.

const DEFAULTS = {
  apiBase: "http://localhost:8000",
  webBase: "http://localhost:3000",
};

const MENU_ID = "veritas-verify-image";

async function getConfig() {
  const stored = await chrome.storage.local.get(["apiBase", "webBase"]);
  return {
    apiBase: stored.apiBase || DEFAULTS.apiBase,
    webBase: stored.webBase || DEFAULTS.webBase,
  };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Verify with Veritas Stack",
    contexts: ["image"],
  });
});

// Chrome's storage is per-extension-install. On service-worker wake the
// menu already exists — onInstalled runs only on first install/upgrade.

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const srcUrl = info.srcUrl;
  if (!srcUrl) {
    console.error("[Veritas] no srcUrl on context-menu click");
    return;
  }
  try {
    await verifyImage(srcUrl, tab);
  } catch (err) {
    console.error("[Veritas] verify failed", err);
    notifyError(tab, String(err?.message ?? err));
  }
});

async function verifyImage(srcUrl, tab) {
  const cfg = await getConfig();

  const imgResp = await fetch(srcUrl, { credentials: "omit" });
  if (!imgResp.ok) throw new Error(`image fetch ${imgResp.status}`);
  const blob = await imgResp.blob();
  const filename = filenameFromUrl(srcUrl, blob.type);

  const form = new FormData();
  form.append("file", blob, filename);

  const verifyResp = await fetch(`${cfg.apiBase}/verify`, {
    method: "POST",
    body: form,
  });
  if (!verifyResp.ok) {
    throw new Error(`/verify ${verifyResp.status}`);
  }
  const report = await verifyResp.json();
  const token = encodeReport({ report, source_url: srcUrl });
  const reportUrl = `${cfg.webBase}/report?token=${token}`;
  chrome.tabs.create({ url: reportUrl, openerTabId: tab?.id });
}

function encodeReport(payload) {
  const json = JSON.stringify(payload);
  // base64url so the token survives in a URL without %-encoding.
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function filenameFromUrl(url, mime) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() || "image";
    if (last.includes(".")) return last;
    const ext = (mime || "image/jpeg").split("/")[1] || "jpg";
    return `${last}.${ext}`;
  } catch {
    return "image.jpg";
  }
}

function notifyError(tab, message) {
  if (!tab?.id) return;
  chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      func: (msg) => {
        // Best-effort toast — page CSP may block; that's fine.
        const el = document.createElement("div");
        el.textContent = `Veritas Stack: ${msg}`;
        el.style.cssText =
          "position:fixed;bottom:16px;right:16px;z-index:2147483647;padding:12px 16px;background:#dc2626;color:#fff;font:13px system-ui;border-radius:6px;box-shadow:0 6px 24px rgba(0,0,0,.25)";
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 6000);
      },
      args: [message],
    })
    .catch(() => {});
}
