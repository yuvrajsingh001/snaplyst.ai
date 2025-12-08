import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * Generate CSV from template file
 * Reads the header row from the template CSV/XLSX and uses it to format rows
 * Supports both CSV and XLSX template files
 * Handles Depop template structure: Row 1 (version), Row 2 (headers), Row 3 (helper text)
 * 
 * @param templatePath - Path to template file in public folder (e.g., "/templates/depop_template.csv" or "/templates/depop_template.xlsx")
 * @param rows - Array of objects where keys are human-readable column names matching the template
 * @returns CSV string ready for download
 */
export async function generateCsvFromTemplate(
  templatePath: string,
  rows: Record<string, string | number | null | undefined>[]
): Promise<string> {
  let templateRows: string[][] = [];

  // Load template file
  if (templatePath.endsWith(".xlsx")) {
    // Handle XLSX file
    const res = await fetch(templatePath);
    if (!res.ok) {
      throw new Error(`Failed to load template XLSX from ${templatePath}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    
    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error(`Template XLSX at ${templatePath} has no sheets`);
    }

    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to array of arrays to get all rows
    const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { 
      header: 1,
      defval: "",
      raw: false
    }) as string[][];

    if (!jsonData || jsonData.length === 0) {
      throw new Error(`Template XLSX at ${templatePath} has no rows`);
    }

    templateRows = jsonData;

  } else {
    // Handle CSV file
    const res = await fetch(templatePath);
    if (!res.ok) {
      throw new Error(`Failed to load template CSV from ${templatePath}`);
    }

    const text = await res.text();
    const parsed = Papa.parse<string[]>(text, { 
      header: false, 
      skipEmptyLines: false // Don't skip empty lines to preserve structure
    });

    if (!parsed.data || parsed.data.length === 0) {
      throw new Error(`Template CSV at ${templatePath} has no rows`);
    }

    templateRows = parsed.data;
  }

  // Check if this is a Depop template (has template version in first row, first column)
  const isDepopTemplate = templateRows.length >= 3 && 
    templateRows[0] && 
    templateRows[0][0] && 
    String(templateRows[0][0]).toLowerCase().includes("template version");

  if (isDepopTemplate) {
    // Depop template structure:
    // Row 1 (index 0): Template version (keep as-is)
    // Row 2 (index 1): Column headers (use these)
    // Row 3 (index 2): Helper text (keep as-is)
    // Row 4+ (index 3+): Product data
    
    if (templateRows.length < 3) {
      throw new Error(`Depop template at ${templatePath} must have at least 3 rows (version, headers, helper text)`);
    }

    const headerRow = templateRows[1]; // Row 2 (0-indexed)
    if (!headerRow) {
      throw new Error(`Depop template at ${templatePath} has no header row`);
    }
    
    const headers = headerRow
      .map((h) => (h != null ? String(h).trim() : ""))
      .filter((h) => h !== "");

    if (headers.length === 0) {
      throw new Error(`Depop template at ${templatePath} has no valid headers`);
    }

    // Debug: Log headers and sample row keys
    if (rows.length > 0) {
      const sampleRowKeys = Object.keys(rows[0]);
      console.log("Depop template headers:", headers);
      console.log("Sample row keys:", sampleRowKeys);
      console.log("Matching keys:", headers.filter(h => sampleRowKeys.includes(h)));
    }

    // Build CSV with Depop structure
    const csvRows: string[] = [];
    
    // Row 1: Template version (keep as-is, preserve all columns)
    const versionRow = templateRows[0];
    if (versionRow) {
      csvRows.push(Papa.unparse([versionRow], { header: false }));
    }
    
    // Row 2: Headers (keep as-is, preserve all columns)
    csvRows.push(Papa.unparse([headerRow], { header: false }));
    
    // Row 3: Helper text (keep as-is, preserve all columns)
    if (templateRows[2]) {
      csvRows.push(Papa.unparse([templateRows[2]], { header: false }));
    }
    
    // Row 4+: Product data
    const formattedRows = rows.map((row) => {
      const out: string[] = [];
      headerRow.forEach((header, index) => {
        const headerTrimmed = header != null ? String(header).trim() : "";
        
        // Try exact match first, then case-insensitive match
        let value: string | number | null | undefined = row[headerTrimmed];
        if (value === undefined && headerTrimmed !== "") {
          const matchingKey = Object.keys(row).find(
            (k) => k.toLowerCase().trim() === headerTrimmed.toLowerCase().trim()
          );
          if (matchingKey) {
            value = row[matchingKey];
          }
        }
        
        // Convert to string, maintaining column position
        const stringValue = value === null || value === undefined
          ? ""
          : typeof value === "string"
          ? value
          : String(value);
        
        out[index] = stringValue;
      });
      
      return out;
    });
    
    // Add product data rows
    formattedRows.forEach((row) => {
      csvRows.push(Papa.unparse([row], { header: false }));
    });
    
    const csv = csvRows.join("\n");
    
    if (!csv || csv.trim().length === 0) {
      throw new Error(`Generated CSV is empty. Headers: ${headers.join(", ")}, Rows: ${rows.length}`);
    }

    return csv;
    
  } else {
    // Standard template structure (first row is headers)
    const headerRow = templateRows[0];
    if (!headerRow) {
      throw new Error(`Template at ${templatePath} has no header row`);
    }
    
    const headers = headerRow
      .map((h) => (h != null ? String(h).trim() : ""))
      .filter((h) => h !== "");

    if (headers.length === 0) {
      throw new Error(`Template at ${templatePath} has no valid headers`);
    }

    // Debug: Log headers and sample row keys
    if (rows.length > 0) {
      const sampleRowKeys = Object.keys(rows[0]);
      console.log("Template headers:", headers);
      console.log("Sample row keys:", sampleRowKeys);
      console.log("Matching keys:", headers.filter(h => sampleRowKeys.includes(h)));
    }

    // 2) For each row object, build a new row following the template header order
    const formattedRows = rows.map((row) => {
      const out: Record<string, string> = {};
      headers.forEach((header) => {
        // Try exact match first, then case-insensitive match
        let value = row[header];
        if (value === undefined) {
          // Try case-insensitive match
          const matchingKey = Object.keys(row).find(
            (k) => k.toLowerCase().trim() === header.toLowerCase().trim()
          );
          if (matchingKey) {
            value = row[matchingKey];
          }
        }
        
        out[header] =
          value === null || value === undefined
            ? ""
            : typeof value === "string"
            ? value
            : String(value);
      });
      return out;
    });

    // 3) Use Papa.unparse with the *same* header order
    const csv = Papa.unparse({
      fields: headers,
      data: formattedRows.map((r) => headers.map((h) => r[h] ?? "")),
    });

    if (!csv || csv.trim().length === 0) {
      throw new Error(`Generated CSV is empty. Headers: ${headers.join(", ")}, Rows: ${rows.length}`);
    }

    return csv;
  }
}
