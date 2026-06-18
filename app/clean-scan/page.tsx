import WorkspaceToolPage from "@/components/WorkspaceToolPage";

export default function CleanScanPage() {
  return (
    <WorkspaceToolPage
      eyebrow="AI cleanup"
      title="Clean shadows, fingers, and stains from scans"
      description="Prepare scan photos for AI cleanup and export cleaner document pages."
      primary={{ href: "/image-to-pdf", label: "Start with scanner", icon: "cleaning_services" }}
      secondary={{ href: "/edit", label: "Patch in PDF editor", icon: "edit" }}
      ai
      steps={[
        "Create the scan with auto crop and B&W or grayscale enhancement.",
        "Use the PDF editor to cover stains, fingers, or edge artifacts.",
        "Export a cleaned PDF, then run OCR or AI tools if needed.",
      ]}
      capabilities={[
        "Clean-scan workflow is now represented as a dedicated tool.",
        "Uses existing scanner filters for shadows and contrast.",
        "Uses the PDF editor for manual artifact removal.",
        "Ready for a future AI inpainting backend for finger/stain removal.",
      ]}
      note="The current app can crop, enhance, and manually patch scan artifacts. Fully automatic finger/stain removal needs an image inpainting model, which should be added as a backend service before promising one-click cleanup."
    />
  );
}
