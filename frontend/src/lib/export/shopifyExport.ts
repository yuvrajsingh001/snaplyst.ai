import { generateCsvFromTemplate } from "./fromTemplate";
import type { ProductForExport } from "../types/export";
import { toShopifyRows } from "./mappers/shopify";

/**
 * Export products to Shopify CSV format using the official template
 */
export async function exportShopifyCsv(products: ProductForExport[]): Promise<string> {
  if (products.length === 0) {
    throw new Error("No products to export");
  }

  const allRows = products.flatMap(toShopifyRows);
  
  // Debug: Log handles to verify uniqueness
  const handles = new Set<string>();
  allRows.forEach((row, index) => {
    const handle = row.Handle;
    if (handles.has(handle)) {
      console.warn(`Duplicate handle "${handle}" found at row ${index + 1}`);
    }
    handles.add(handle);
  });
  console.log(`Exporting ${products.length} products as ${allRows.length} rows with ${handles.size} unique handles`);
  
  const templatePath = "/templates/shopify-template.csv";
  
  return generateCsvFromTemplate(templatePath, allRows);
}

