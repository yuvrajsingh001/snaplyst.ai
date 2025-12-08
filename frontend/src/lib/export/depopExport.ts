import { generateCsvFromTemplate } from "./fromTemplate";
import type { ProductForExport } from "../types/export";
import { toDepopRow } from "./mappers/depop";

/**
 * Export products to Depop CSV format using the official template
 */
export async function exportDepopCsv(products: ProductForExport[]): Promise<string> {
  if (products.length === 0) {
    throw new Error("No products to export");
  }

  const rows = products.map(toDepopRow);
  
  // Template is CSV in public/templates
  const templatePath = "/templates/depop-template.csv";
  
  return generateCsvFromTemplate(templatePath, rows);
}

