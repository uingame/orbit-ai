import * as XLSX from "xlsx";

export type ImportRow = Record<string, string>;

export async function parseImportFile(file: File): Promise<ImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("The file is empty");
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  return rows.map((row) => {
    const normalized: ImportRow = {};
    for (const [key, value] of Object.entries(row)) {
      const cleanKey = String(key).trim();
      if (!cleanKey) continue;
      normalized[cleanKey] = value === null || value === undefined ? "" : String(value).trim();
    }
    return normalized;
  });
}

export function validateRequiredColumns(
  rows: ImportRow[],
  required: string[],
): { ok: true } | { ok: false; missing: string[] } {
  if (rows.length === 0) {
    return { ok: false, missing: required };
  }
  const headers = new Set(Object.keys(rows[0]));
  const missing = required.filter((col) => !headers.has(col));
  if (missing.length > 0) {
    return { ok: false, missing };
  }
  return { ok: true };
}
