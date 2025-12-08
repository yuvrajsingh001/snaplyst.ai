// Re-export the new template-based export functions
export { exportDepopCsv } from "./depopExport";
export { exportShopifyCsv } from "./shopifyExport";
export { downloadCsv } from "./download";

// Re-export mappers for backward compatibility if needed
export { toDepopRow } from "./mappers/depop";
export { toShopifyRows } from "./mappers/shopify";

