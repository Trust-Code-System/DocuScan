import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  // share_target isn't in Next's Manifest type yet — build untyped, then cast.
  const m = {
    name: "DocuScan — Scan, edit & share PDFs",
    short_name: "DocuScan",
    description:
      "The fastest way to scan, clean, edit, compress and share documents from your phone or browser.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#f97316",
    orientation: "portrait",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Scan to PDF", url: "/image-to-pdf" },
      { name: "Edit PDF", url: "/edit" },
      { name: "Compress PDF", url: "/compress-pdf" },
    ],
    // Lets the OS share sheet (incl. WhatsApp on Android) send a file straight
    // into DocuScan. The service worker catches the POST and hands off to /edit.
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [
          {
            name: "file",
            accept: ["application/pdf", "image/*"],
          },
        ],
      },
    },
  };
  return m as MetadataRoute.Manifest;
}
