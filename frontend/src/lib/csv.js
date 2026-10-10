// Quote anything that would otherwise break the column layout.
const cell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

/**
 * Turns table rows into CSV text.
 *
 * Action columns and object values hold buttons and attachments rather than
 * data, so they are skipped instead of exporting as "[object Object]".
 *
 * A column that shows several fields at once can set exportValue(row) so the
 * spreadsheet carries all of them, not just the one its key points at.
 */
export function toCsv(columns, rows) {
  const exportable = columns.filter((c) => c.key !== "actions");
  const header = exportable.map((c) => cell(c.header));
  const body = rows.map((row) =>
    exportable.map((column) => {
      const value = column.exportValue
        ? column.exportValue(row)
        : row[column.key];
      return cell(typeof value === "object" && value !== null ? "" : value);
    })
  );
  return [header, ...body].map((line) => line.join(",")).join("\n");
}

/** Hands the CSV to the browser as a download. */
export function downloadCsv(csv, fileName) {
  // The byte order mark keeps Excel from mangling Arabic text.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
