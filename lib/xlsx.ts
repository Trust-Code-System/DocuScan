import JSZip from "jszip";

type XlsxCell =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number; style?: number }
  | { kind: "date"; value: number; style: number };

type XlsxOptions = {
  sheetName: string;
  columns: string[];
  rows: string[][];
};

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    name = String.fromCharCode(65 + r) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, " ").trim() || "Data";
  return cleaned.slice(0, 31);
}

function excelDateSerial(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000 + 25_569;
}

function parseCell(raw: string): XlsxCell {
  const value = String(raw ?? "").trim();
  if (!value) return { kind: "string", value: "" };

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { kind: "date", value: excelDateSerial(value), style: 3 };
  }

  const money = value.match(/^\(?-?\$?\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.[0-9]{1,2})?\)?$/);
  if (money && (value.includes("$") || value.includes(","))) {
    const negative = value.startsWith("-") || (value.startsWith("(") && value.endsWith(")"));
    const amount = Number(value.replace(/[$,\s()]/g, "").replace(/^-/, ""));
    if (Number.isFinite(amount)) return { kind: "number", value: negative ? -amount : amount, style: 2 };
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    const n = Number(value);
    if (Number.isFinite(n)) return { kind: "number", value: n };
  }

  return { kind: "string", value };
}

function sharedStringIndex(value: string, strings: string[], map: Map<string, number>): number {
  const existing = map.get(value);
  if (existing !== undefined) return existing;
  const index = strings.length;
  strings.push(value);
  map.set(value, index);
  return index;
}

function cellXml(
  rowIndex: number,
  colIndex: number,
  cell: XlsxCell,
  strings: string[],
  stringMap: Map<string, number>,
  style = 0,
): string {
  const ref = `${columnName(colIndex)}${rowIndex}`;
  if (cell.kind === "string") {
    const index = sharedStringIndex(cell.value, strings, stringMap);
    return `<c r="${ref}" t="s" s="${style}"><v>${index}</v></c>`;
  }
  const cellStyle = cell.style ?? style;
  return `<c r="${ref}" s="${cellStyle}"><v>${cell.value}</v></c>`;
}

function widthFor(values: string[]): number {
  const longest = Math.max(10, ...values.map((v) => String(v ?? "").length));
  return Math.min(36, Math.max(12, longest + 3));
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${NS}">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="$#,##0.00;[Red]-$#,##0.00"/>
    <numFmt numFmtId="165" formatCode="yyyy-mm-dd"/>
  </numFmts>
  <fonts count="2">
    <font><sz val="11"/><color rgb="FF0F172A"/><name val="Aptos"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFF6B00"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FFE2E8F0"/></bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;
}

export async function rowsToXlsxBlob(options: XlsxOptions): Promise<Blob> {
  const columns = options.columns.map((c) => String(c || "").trim() || "Column");
  const rows = options.rows.map((row) => columns.map((_, i) => String(row[i] ?? "")));
  const strings: string[] = [];
  const stringMap = new Map<string, number>();
  const lastCol = columnName(Math.max(columns.length - 1, 0));
  const lastRow = Math.max(rows.length + 1, 1);
  const ref = `A1:${lastCol}${lastRow}`;

  const widths = columns.map((column, index) => widthFor([column, ...rows.map((row) => row[index] || "")]));
  const colsXml = widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("");

  const header = `<row r="1">${columns
    .map((column, i) => cellXml(1, i, { kind: "string", value: column }, strings, stringMap, 1))
    .join("")}</row>`;
  const body = rows
    .map((row, rowIndex) => {
      const r = rowIndex + 2;
      const cells = row.map((value, colIndex) => cellXml(r, colIndex, parseCell(value), strings, stringMap));
      return `<row r="${r}">${cells.join("")}</row>`;
    })
    .join("");

  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS}" xmlns:r="${REL_NS}">
  <dimension ref="${ref}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${colsXml}</cols>
  <sheetData>${header}${body}</sheetData>
  <autoFilter ref="${ref}"/>
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>`;

  const sharedStrings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="${NS}" uniqueCount="${strings.length}">
${strings.map((s) => `<si><t>${xml(s)}</t></si>`).join("")}
</sst>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NS}" xmlns:r="${REL_NS}">
  <sheets><sheet name="${xml(safeSheetName(options.sheetName))}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`);
  zip.file("xl/worksheets/sheet1.xml", worksheet);
  zip.file("xl/styles.xml", stylesXml());
  zip.file("xl/sharedStrings.xml", sharedStrings);
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>DocuScan</dc:creator>
  <cp:lastModifiedBy>DocuScan</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`);
  zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>DocuScan</Application>
</Properties>`);

  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
