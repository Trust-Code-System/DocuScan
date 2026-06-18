import WorkspaceToolPage from "@/components/WorkspaceToolPage";

export default function PdfToWordPage() {
  return (
    <WorkspaceToolPage
      eyebrow="Convert"
      title="Convert PDF to Word"
      description="Create an editable Word document from a PDF or scan."
      primary={{ href: "/reconstruct", label: "Convert with AI", icon: "auto_awesome" }}
      secondary={{ href: "/convert", label: "Open converter", icon: "sync_alt" }}
      ai
      steps={[
        "Upload a PDF or scanned document.",
        "Extract text locally, reconstruct the structure, and review the editable content.",
        "Export the result as a Word .docx file.",
      ]}
      capabilities={[
        "Best for scanned PDFs and documents without a usable text layer.",
        "Exports to .docx from the existing editable-document flow.",
        "Keeps headings, paragraphs, lists, and simple tables.",
        "Universal converter remains available for server-backed Office paths.",
      ]}
    />
  );
}
