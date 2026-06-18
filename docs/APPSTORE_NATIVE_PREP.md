# DocuScan App Store Preparation

This repo is now prepared for a future native shell without turning the web app
into a fragile WebView-only submission.

## Native shell contract

The iOS/Android shell should inject `window.DocuScanNative` before the web app
loads:

```ts
window.DocuScanNative = {
  pickCameraImages: async () => [{ name, type, dataBase64 }],
  pickDocumentFiles: async () => [{ name, type, dataBase64 }],
  shareFile: async ({ name, type, dataBase64 }) => {},
  saveFile: async ({ name, type, dataBase64 }) => {},
};
```

`dataBase64` is raw base64, without a `data:` URL prefix.

## App-like features already prepared

- Native bridge abstraction: `lib/nativeBridge.ts`
- Native camera/file picker hooks in `/image-to-pdf`
- Native export/share handoff for PDF results
- Offline recent PDFs stored in IndexedDB: `lib/recentDocs.ts`
- Recent scans screen: `/recents`
- PWA share target for Android: `/share-target`
- Offline shell cache includes `/recents`

## Native shell still required later

- iOS project and App Store signing in Xcode
- Android project and Play signing
- Native camera scanner UI, ideally with document edge detection
- iOS document picker and share extension
- Android document picker and share intent
- Native share/export sheet
- Optional iCloud/Files provider persistence
- Native navigation wrapper that opens the core routes directly

## Review positioning

For Apple, do not submit this as only a generic WebView. The native shell should
make scanning, importing, exporting, and recent files feel like OS-level
document workflows. The web app can remain the main editing engine, but the
entry points and file lifecycle should be native.
