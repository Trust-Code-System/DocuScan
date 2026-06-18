import WorkspaceToolPage from "@/components/WorkspaceToolPage";

export default function PdfToImagePage() {
  return (
    <WorkspaceToolPage
      eyebrow="Convert"
      title="Convert PDF to images"
      description="Export PDF pages as image files for sharing, previews, or downstream editing."
      primary={{ href: "/convert", label: "Open converter", icon: "image" }}
      secondary={{ href: "/split-pdf", label: "Split pages first", icon: "call_split" }}
      steps={[
        "Upload your PDF in the universal converter.",
        "Choose an image target such as PNG or JPEG when available.",
        "Download each page image or a ZIP of outputs.",
      ]}
      capabilities={[
        "Specific PDF-to-image route for users who search by target format.",
        "Uses the existing universal conversion hub.",
        "Pairs with Split PDF when users need page-level control.",
        "Keeps the conversion workflow centralized.",
      ]}
    />
  );
}
