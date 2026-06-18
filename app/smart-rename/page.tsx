import WorkspaceToolPage from "@/components/WorkspaceToolPage";

export default function SmartRenamePage() {
  return (
    <WorkspaceToolPage
      eyebrow="Smart organization"
      title="Rename files smartly"
      description="Generate short, descriptive, filesystem-safe names from document content."
      primary={{ href: "/smart", label: "Suggest a name", icon: "drive_file_rename_outline" }}
      secondary={{ href: "/detect-document-type", label: "Detect type", icon: "category" }}
      ai
      steps={[
        "Upload a file in the AI document assistant.",
        "Use Suggest a name to generate a clean filename.",
        "Use tags and category to organize the file with less manual typing.",
      ]}
      capabilities={[
        "Dedicated route for smart file naming.",
        "Creates short names based on actual document text.",
        "Avoids unsafe filename characters.",
        "Works alongside auto-tagging and document type detection.",
      ]}
    />
  );
}
