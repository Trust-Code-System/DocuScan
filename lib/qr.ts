/**
 * QR code generation. The `qrcode` lib is dynamically imported the first time a
 * QR is requested, so it never lands in the main bundle (only loads on the
 * result screen when a user actually shares).
 */

export async function makeQrDataUrl(text: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text, {
    width: 220,
    margin: 1,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}
