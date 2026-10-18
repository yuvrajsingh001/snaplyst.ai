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

  const handles = new Set<string>();
  const allRows = products.flatMap((product) => {
    const rows = toShopifyRows(product);
    const handle = rows[0]?.Handle ?? "";
    // Extra image rows and variants repeat the handle on purpose. Warn only
    // when a second product generates the same handle.
    if (handle && handles.has(handle)) {
      console.warn(
        `Duplicate handle "${handle}" for product "${product.title || product.id}"`,
      );
    } else if (handle) {
      handles.add(handle);
    }
    return rows;
  });
  console.log(
    `Exporting ${products.length} products as ${allRows.length} rows with ${handles.size} unique handles`,
  );
  
  const templatePath = "/templates/shopify-template.csv";
  
  return generateCsvFromTemplate(templatePath, allRows);
}

