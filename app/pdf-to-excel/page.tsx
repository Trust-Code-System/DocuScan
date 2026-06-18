import WorkspaceToolPage from "@/components/WorkspaceToolPage";
import ExtractTool from "@/app/extract/page";

export default function PdfToExcelPage() {
  return (
    <WorkspaceToolPage
      eyebrow="Convert"
      title="Convert PDF tables to Excel"
      description="Extract tables, invoices, statements, and custom fields from PDFs into spreadsheet-ready data."
      secondary={{ href: "/convert", label: "Open converter", icon: "sync_alt" }}
      ai
      steps={[
        "Upload the PDF, scan, invoice, receipt, or statement.",
        "Choose a preset or define the columns you need.",
        "Review the editable table and export CSV for Excel.",
      ]}
      capabilities={[
        "Invoice, receipt, bank statement, attendance, ID, and custom presets.",
        "Editable table output before export.",
        "CSV opens directly in Excel and spreadsheet tools.",
        "Confidence markers for extracted rows.",
      ]}
    >
      <ExtractTool />
    </WorkspaceToolPage>
  );
}
