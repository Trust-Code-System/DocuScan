import WorkspaceToolPage from "@/components/WorkspaceToolPage";

export default function FillablePdfPage() {
  return (
    <WorkspaceToolPage
      eyebrow="Forms"
      title="Turn forms into fillable PDFs"
      description="Prepare scanned forms for typing, signing, and structured data capture."
      primary={{ href: "/edit", label: "Open PDF editor", icon: "edit_document" }}
      secondary={{ href: "/extract", label: "Extract form fields", icon: "table" }}
      ai
      steps={[
        "Upload a form or scan in the PDF editor.",
        "Add text boxes, signature fields, and annotations where needed.",
        "Use Extract to table when you need form field data as rows and columns.",
      ]}
      capabilities={[
        "Dedicated fillable-form route in the tools workspace.",
        "Manual text and signature placement through the PDF editor.",
        "Form-field extraction through the AI table workflow.",
        "Ready for automatic AcroForm field generation in a future backend pass.",
      ]}
      note="The current editor can add text and signatures to forms. True automatic fillable PDF field generation needs an AcroForm generation layer, so this route separates the product surface from that deeper implementation."
    />
  );
}
