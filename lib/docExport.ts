/**
 * Clean-document export — render a structured DocBlock[] (from the AI
 * "reconstruct"/"translate" tasks, edited by the user) to a clean PDF or DOCX.
 *
 * This produces a tidy, editable document — NOT a pixel-perfect clone of the
 * original (same trade-off as "export to Word"). The block layout engine here
 * is pure @cantoo/pdf-lib (no DOM), so blocksToPdf is Node-testable; the DOCX
 * path uses `docx` and is dynamic-imported by callers to stay out of the main
 * bundle.
 *
 * The markdown helpers give the editor a simple, familiar serialisable form:
 * blocks ⇄ markdown round-trips so the user can edit freely as text.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "@cantoo/pdf-lib";
import type { DocBlock } from "@/lib/ai";

export type { DocBlock };

// ---- markdown round-trip ---------------------------------------------------

export function blocksToMarkdown(blocks: DocBlock[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === "heading") {
      out.push("#".repeat(Math.min(6, Math.max(1, b.level ?? 2))) + " " + (b.text ?? ""));
    } else if (b.type === "paragraph") {
      out.push(b.text ?? "");
    } else if (b.type === "list") {
      for (const it of b.items ?? []) out.push("- " + it);
    } else if (b.type === "table") {
      const rows = b.rows ?? [];
      if (rows.length) {
        const cols = Math.max(...rows.map((r) => r.length));
        const pad = (r: string[]) =>
          "| " + Array.from({ length: cols }, (_, i) => r[i] ?? "").join(" | ") + " |";
        out.push(pad(rows[0]));
        out.push("| " + Array.from({ length: cols }, () => "---").join(" | ") + " |");
        for (const r of rows.slice(1)) out.push(pad(r));
      }
    }
    out.push("");
  }
  return out.join("\n").trim() + "\n";
}

export function markdownToBlocks(md: string): DocBlock[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: DocBlock[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let table: string[][] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: "paragraph", text: para.join(" ").trim() });
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ type: "list", items: list.slice() });
      list = [];
    }
  };
  const flushTable = () => {
    if (table.length) {
      blocks.push({ type: "table", rows: table.slice() });
      table = [];
    }
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushTable();
  };

  const cells = (line: string) =>
    line
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .split("|")
      .map((c) => c.trim());

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushAll();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    const isTableRow = /^\s*\|.*\|\s*$/.test(line);

    if (heading) {
      flushAll();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
    } else if (isTableRow) {
      flushPara();
      flushList();
      const c = cells(line);
      // skip the |---|---| separator row
      if (!c.every((x) => /^:?-{2,}:?$/.test(x.replace(/\s/g, "")))) table.push(c);
    } else if (bullet || numbered) {
      flushPara();
      flushTable();
      list.push((bullet ?? numbered)![1].trim());
    } else {
      flushList();
      flushTable();
      para.push(line.trim());
    }
  }
  flushAll();
  return blocks;
}

// ---- PDF (pure pdf-lib, Node-testable) -------------------------------------

const PW = 595.28; // A4
const PH = 841.89;
const M = 56;
const MAXW = PW - M * 2;

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = t;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function blocksToPdf(blocks: DocBlock[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PW, PH]);
  let y = PH - M;
  const ensure = (h: number) => {
    if (y - h < M) {
      page = doc.addPage([PW, PH]);
      y = PH - M;
    }
  };
  const drawWrapped = (
    text: string,
    f: PDFFont,
    size: number,
    color: ReturnType<typeof rgb>,
    indent = 0,
    gapAfter = 6,
  ) => {
    const lh = size * 1.35;
    for (const ln of wrap(text, f, size, MAXW - indent)) {
      ensure(lh);
      page.drawText(ln, { x: M + indent, y: y - size, size, font: f, color });
      y -= lh;
    }
    y -= gapAfter;
  };

  const drawTable = (rows: string[][]) => {
    if (!rows.length) return;
    const cols = Math.max(...rows.map((r) => r.length));
    const colW = MAXW / cols;
    const size = 10;
    const pad = 4;
    const border = rgb(0.7, 0.7, 0.7);
    for (let ri = 0; ri < rows.length; ri++) {
      const f = ri === 0 ? bold : font;
      const cellLines = Array.from({ length: cols }, (_, ci) =>
        wrap(rows[ri][ci] ?? "", f, size, colW - pad * 2),
      );
      const rowH = Math.max(...cellLines.map((c) => c.length)) * (size * 1.3) + pad * 2;
      ensure(rowH);
      const top = y;
      cellLines.forEach((cl, ci) => {
        let cy = top - pad - size;
        for (const ln of cl) {
          page.drawText(ln, { x: M + ci * colW + pad, y: cy, size, font: f, color: rgb(0, 0, 0) });
          cy -= size * 1.3;
        }
      });
      for (let ci = 0; ci <= cols; ci++) {
        page.drawLine({
          start: { x: M + ci * colW, y: top },
          end: { x: M + ci * colW, y: top - rowH },
          thickness: 0.5,
          color: border,
        });
      }
      page.drawLine({ start: { x: M, y: top }, end: { x: M + MAXW, y: top }, thickness: 0.5, color: border });
      page.drawLine({
        start: { x: M, y: top - rowH },
        end: { x: M + MAXW, y: top - rowH },
        thickness: 0.5,
        color: border,
      });
      y = top - rowH;
    }
    y -= 8;
  };

  for (const b of blocks) {
    if (b.type === "heading") {
      const lvl = b.level ?? 2;
      const size = lvl <= 1 ? 22 : lvl === 2 ? 16 : 13;
      y -= 6;
      drawWrapped(b.text ?? "", bold, size, rgb(0.1, 0.1, 0.12), 0, 6);
    } else if (b.type === "paragraph") {
      drawWrapped(b.text ?? "", font, 11, rgb(0, 0, 0), 0, 6);
    } else if (b.type === "list") {
      for (const it of b.items ?? []) drawWrapped("•  " + it, font, 11, rgb(0, 0, 0), 14, 2);
      y -= 4;
    } else if (b.type === "table") {
      drawTable(b.rows ?? []);
    }
  }

  return doc.save();
}

// ---- DOCX (dynamic-imported docx) ------------------------------------------

export async function blocksToDocxBlob(blocks: DocBlock[]): Promise<Blob> {
  const docx = await import("docx");
  const {
    Document,
    Packer,
    Paragraph,
    HeadingLevel,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
  } = docx;

  const headingFor = (lvl: number) =>
    lvl <= 1 ? HeadingLevel.HEADING_1 : lvl === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
  for (const b of blocks) {
    if (b.type === "heading") {
      children.push(new Paragraph({ text: b.text ?? "", heading: headingFor(b.level ?? 2) }));
    } else if (b.type === "paragraph") {
      children.push(new Paragraph({ children: [new TextRun(b.text ?? "")] }));
    } else if (b.type === "list") {
      for (const it of b.items ?? []) children.push(new Paragraph({ text: it, bullet: { level: 0 } }));
    } else if (b.type === "table") {
      const rows = b.rows ?? [];
      if (rows.length) {
        const cols = Math.max(...rows.map((r) => r.length));
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: rows.map(
              (r) =>
                new TableRow({
                  children: Array.from(
                    { length: cols },
                    (_, ci) =>
                      new TableCell({ children: [new Paragraph(r[ci] ?? "")] }),
                  ),
                }),
            ),
          }),
        );
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}
