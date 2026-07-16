type SheetDefinition = {
  name: string;
  rows: Record<string, unknown>[];
};

function normalizeExcelValue(value: unknown): string | number | boolean {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return value == null ? "" : String(value);
}

/** Lê CSV ou XLSX sem depender do pacote SheetJS vulnerável. */
export async function readSpreadsheet(file: File): Promise<Record<string, unknown>[]> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    const Papa = (await import("papaparse")).default;
    const result = Papa.parse<Record<string, unknown>>(await file.text(), {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: true,
    });
    if (result.errors.length) {
      throw new Error(`CSV inválido: ${result.errors[0].message}`);
    }
    return result.data;
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Formato não suportado. Use .xlsx ou .csv.");
  }

  const { readSheet } = await import("read-excel-file/browser");
  const data = await readSheet(file);
  if (!data.length) throw new Error("A planilha está vazia.");
  const headers = data[0].map((value) => String(normalizeExcelValue(value)).trim());
  if (!headers.some(Boolean)) throw new Error("A planilha não possui cabeçalho.");

  const rows: Record<string, unknown>[] = [];
  for (const row of data.slice(1)) {
    const record: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const value = normalizeExcelValue(row[index]);
      record[header] = value;
      if (value !== "" && value != null) hasValue = true;
    });
    if (hasValue) rows.push(record);
  }
  return rows;
}

export async function downloadSpreadsheet(sheets: SheetDefinition[], filename: string): Promise<void> {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const definitions = sheets.map((definition) => {
    const headers = Array.from(new Set(definition.rows.flatMap((row) => Object.keys(row))));
    const headerRow = headers.map((header) => ({ value: header, fontWeight: "bold" as const }));
    const dataRows = definition.rows.map((row) => headers.map((header) => normalizeExcelValue(row[header])));
    return {
      data: [headerRow, ...dataRows],
      sheet: definition.name.slice(0, 31),
      columns: headers.map((header) => ({ width: Math.max(12, Math.min(40, header.length + 4)) })),
      stickyRowsCount: 1,
    };
  });
  if (!definitions.length) throw new Error("Não há dados para exportar.");
  await writeExcelFile(definitions).toFile(filename);
}
