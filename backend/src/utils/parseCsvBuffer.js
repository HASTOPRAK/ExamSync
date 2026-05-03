import { parse } from "csv-parse/sync";

function normalizeValue(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function parseCsvBuffer(buffer) {
  const content = buffer.toString("utf-8");

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  return records.map((row) => {
    const normalizedRow = {};

    for (const [key, value] of Object.entries(row)) {
      normalizedRow[normalizeValue(key)] = normalizeValue(value);
    }

    return normalizedRow;
  });
}

export default parseCsvBuffer;
