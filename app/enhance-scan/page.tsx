import WorkspaceToolPage from "@/components/WorkspaceToolPage";
import ScanTool from "@/app/image-to-pdf/page";

export default function EnhanceScanPage() {
  return (
    <WorkspaceToolPage
      eyebrow="Scan cleanup"
      title="Enhance scanned images"
      description="Improve scans before export with color, grayscale, and black-and-white document filters."
      secondary={{ href: "/ocr-pdf", label: "Run OCR after export", icon: "document_search" }}
      steps={[
        "Add one or more photos in Scan to PDF.",
        "Open Crop & scan and select Color, Grayscale, or B&W.",
        "Apply the enhancement and create a clean PDF.",
      ]}
      capabilities={[
        "Document-focused grayscale and B&W enhancement.",
        "Perspective correction and page rotation in the same workflow.",
        "Local browser processing for private scans.",
        "OCR handoff for searchable PDFs after export.",
      ]}
    >
      <ScanTool />
    </WorkspaceToolPage>
  );
}
