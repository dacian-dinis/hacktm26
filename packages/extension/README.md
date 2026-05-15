# Veritas Stack — Chrome extension (MV3)

Right-click any image in any tab → "Verify with Veritas Stack" → opens the
report in a new tab against the local Veritas Stack instance.

## Load unpacked (dev)

1. Start the backend: `cd apps/api && uvicorn main:app --port 8000`
2. Start the web app: `cd apps/web && npm run dev` (port 3000)
3. In Chrome (or any Chromium browser): `chrome://extensions` → toggle
   **Developer mode** → **Load unpacked** → select this `packages/extension`
   folder.
4. Click the extension's puzzle icon → Veritas Stack → **Options** to point
   it at a non-default API/web base if needed.
5. Right-click any image on any page → **Verify with Veritas Stack**.

## What it does

- Pulls the right-clicked image's bytes from `info.srcUrl` (handled in the
  service worker so cross-origin fetches work under `host_permissions:
  <all_urls>`).
- POSTs `multipart/form-data` to `{API_BASE}/verify`.
- Base64-url-encodes the returned `Report` JSON into a `?token=` query
  param and opens `{WEB_BASE}/report?token=...` in a new tab.

No persistent storage of report payloads — the token is the report; tokens
are not authenticated and only travel via the user's own browser.

## Limitations (Phase 6 MVP)

- Very large reports (> ~30 KB JSON) approach Chrome's URL length cap.
  Once the backend report grows, swap to `chrome.storage.session` keyed by
  a short UUID.
- No content-script affordance yet — only the right-click path. A hover
  badge on every image could come later.
