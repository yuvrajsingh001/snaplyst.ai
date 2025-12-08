/**
 * Download CSV file in the browser
 */
export function downloadCsv(csv: string, fileName: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

