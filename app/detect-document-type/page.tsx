import WorkspaceToolPage from "@/components/WorkspaceToolPage";

export default function DetectDocumentTypePage() {
  return (
    <WorkspaceToolPage
      eyebrow="Smart organization"
      title="Detect document type automatically"
      description="Classify a file as an invoice, receipt, contract, resume, report, ID, or another document type."
      primary={{ href: "/smart", label: "Classify document", icon: "category" }}
      secondary={{ href: "/smart-rename", label: "Smart rename", icon: "drive_file_rename_outline" }}
      ai
      steps={[
        "Upload any supported document.",
        "DocuScan extracts text locally in the browser.",
        "AI suggests the category and useful tags for filing.",
      ]}
      capabilities={[
        "Document type detection is exposed as its own tool.",
        "Uses the existing AI document assistant classification task.",
        "Works with PDFs, images, Word files, and text documents.",
        "Pairs with smart file naming and structured extraction.",
      ]}
    />
  );
}
