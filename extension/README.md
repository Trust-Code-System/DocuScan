# DocuScan Chrome extension (scaffold)

A minimal Manifest V3 extension that puts DocuScan's tools one click away and
adds a "Open this PDF in DocuScan" right-click item on PDF links.

## Load it locally

1. Add a 128×128 `icon128.png` to this folder (reuse `public/icon.svg` exported to PNG).
2. Visit `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select this `extension/` folder.

## Files

- `manifest.json` — MV3 manifest (action popup + context menu).
- `popup.html` / `popup.js` — toolbar popup listing the tools; opens them at docuscan.app.
- `background.js` — service worker that registers the PDF-link context menu.

## Next steps (not yet wired)

- Export a real `icon128.png` (and 16/48 sizes).
- Pass the right-clicked PDF URL through to the tool (needs the web app to accept
  a `?src=` param and fetch it client-side, respecting CORS).
- Publish to the Chrome Web Store (needs a developer account + store listing).
