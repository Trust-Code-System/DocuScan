"use client";

/**
 * Coerce any supported document into a PDF File. PDFs pass through untouched.
 * Office files try the high-fidelity server converter first, then fall back to
 * the private in-browser converter when the server path is unavailable.
 */

import { detectKind, convert } from "@/lib/convert";

const isPdf = (file: File) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

/**
 * Returns the file unchanged if it's already a PDF; otherwise converts it to one
 * and returns a new PDF File. Throws a friendly error for kinds that cannot be
 * turned into a PDF.
 */
export async function anyFileToPdf(file: File, onStatus?: (status: string) => void): Promise<File> {
  if (isPdf(file)) return file;

  const kind = detectKind(file);
  if (!kind) {
    throw new Error(`"${file.name}" isn't a document this tool can turn into a PDF.`);
  }

  if (kind === "docx") {
    const highFidelityAvailable = await officeConverterAvailable();
    if (highFidelityAvailable) {
      return await highFidelityOfficePdf(file, onStatus);
    }
  }

  onStatus?.(`Converting ${file.name} to PDF...`);
  let out;
  try {
    out = await convert(file, kind, "pdf");
  } catch {
    throw new Error(`Couldn't convert "${file.name}" to PDF. Try converting it first on the Convert page.`);
  }

  const pdf = out.find((f) => f.name.toLowerCase().endsWith(".pdf")) ?? out[0];
  if (!pdf) throw new Error(`Couldn't convert "${file.name}" to PDF.`);

  const stem = file.name.replace(/\.[^./\\]+$/, "") || "document";
  return new File([pdf.blob], `${stem}.pdf`, { type: "application/pdf" });
}

async function officeConverterAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/convert", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { enabled?: boolean };
    return !!data.enabled;
  } catch {
    return false;
  }
}

async function highFidelityOfficePdf(
  file: File,
  onStatus?: (status: string) => void,
): Promise<File> {
  onStatus?.(`Converting ${file.name} with the high-fidelity Office converter...`);
  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("target", "pdf");

  const res = await fetch("/api/convert", { method: "POST", body: fd });
  if (!res.ok) {
    let message = "High-fidelity Word conversion failed.";
    try {
      const data = (await res.json()) as { error?: string; detail?: string };
      message = data.detail ? `${data.error ?? message} ${data.detail}` : data.error ?? message;
    } catch {
      /* keep generic message */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  if (!blob.size) throw new Error("High-fidelity Word conversion returned an empty PDF.");

  const stem = file.name.replace(/\.[^./\\]+$/, "") || "document";
  return new File([blob], `${stem}.pdf`, { type: "application/pdf" });
}
