/**
 * Export data as a CSV file download in the browser.
 * @param filename - The name for the downloaded file (e.g., "teams.csv")
 * @param headers - Array of column header strings
 * @param rows - Array of row arrays (each row is an array of cell values)
 */
export function exportToCSV(filename: string, headers: string[], rows: string[][]) {
  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvContent = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map((cell) => escape(cell ?? "")).join(",")),
  ].join("\n");

  // Add BOM for Excel UTF-8 compatibility
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
