import WorkspaceToolPage from "@/components/WorkspaceToolPage";
import ReconstructTool from "@/app/reconstruct/page";

export default function HandwritingPage() {
  return (
    <WorkspaceToolPage
      eyebrow="AI OCR"
      title="Extract handwritten notes to Word or PDF"
      description="Turn photos of notes, notebooks, and marked-up pages into editable text you can export."
      secondary={{ href: "/ocr-pdf", label: "Try OCR first", icon: "text_fields" }}
      ai
      steps={[
        "Upload the handwritten page or scanned PDF.",
        "Use OCR or Make editable to extract and structure the text.",
        "Review the editable result, then export Word or PDF.",
      ]}
      capabilities={[
        "Dedicated handwriting extraction route in the workspace.",
        "Exports through the existing Make editable Word/PDF flow.",
        "Works with images, PDFs, and mixed document inputs.",
        "Review step is explicit because handwriting confidence varies.",
      ]}
      note="Printed OCR runs locally. High-accuracy handwriting recognition should use an AI vision/OCR model; this page routes into the editable-document workflow until that backend is connected."
    >
      <ReconstructTool />
    </WorkspaceToolPage>
  );
}
