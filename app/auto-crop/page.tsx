import WorkspaceToolPage from "@/components/WorkspaceToolPage";

export default function AutoCropPage() {
  return (
    <WorkspaceToolPage
      eyebrow="Scan cleanup"
      title="Auto crop document scans"
      description="Find document edges, straighten the page, and turn phone photos into clean PDF pages."
      primary={{ href: "/image-to-pdf", label: "Open scanner", icon: "document_scanner" }}
      secondary={{ href: "/enhance-scan", label: "Enhance scans", icon: "tune" }}
      steps={[
        "Upload images or take a photo with your camera.",
        "Open Crop & scan on any page, then use Auto-detect edges.",
        "Fine-tune the corner handles, choose a scan filter, and export the PDF.",
      ]}
      capabilities={[
        "OpenCV edge detection for document-like quadrilaterals.",
        "Manual corner adjustment when a photo has weak edges.",
        "Perspective correction before PDF export.",
        "Works inside the existing scan-to-PDF flow.",
      ]}
    />
  );
}
