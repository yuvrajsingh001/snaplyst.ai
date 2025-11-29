/**
 * Unified Image Processing Pipeline
 * 
 * Processes images to extract:
 * 1. CLIP embeddings (512D vectors) - for semantic similarity
 * 2. Perceptual hash (pHash) - for near-duplicate detection
 * 3. Google Vision labels (optional, for metadata)
 * 
 * This combines the best of both worlds for accurate product grouping.
 */

import { extractCLIPEmbedding, extractCLIPEmbeddings } from "./clipEmbeddings";
import { calculateImageHash, processImageHashes } from "./imageSimilarity";
import { analyzeImageWithVision, processImagesWithVision } from "./googleVision";

// Re-export for convenience
export { groupSimilarImagesCombined, calculateCombinedSimilarityPercentage } from "./combinedSimilarity";

export type ProcessedImage = {
  file: File;
  clipEmbedding: number[];
  pHash: string;
  // Optional: keep Vision labels for metadata/search
  labels?: Array<{ description: string; score: number }>;
  objects?: Array<{ name: string; score: number }>;
};

/**
 * Process a single image to extract CLIP embedding and pHash
 * 
 * @param imageFile - Image file to process
 * @param options - Processing options
 * @returns Processed image with CLIP embedding and pHash
 */
export async function processImage(
  imageFile: File,
  options: {
    clipApiEndpoint?: string;
    includeVisionLabels?: boolean;
    visionApiKey?: string;
  } = {}
): Promise<ProcessedImage> {
  const { clipApiEndpoint, includeVisionLabels = false, visionApiKey } = options;

  // Extract CLIP embedding and pHash in parallel
  const [clipEmbedding, pHash, visionData] = await Promise.all([
    extractCLIPEmbedding(imageFile, clipApiEndpoint),
    calculateImageHash(imageFile),
    includeVisionLabels && visionApiKey
      ? analyzeImageWithVision(imageFile, visionApiKey).catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    file: imageFile,
    clipEmbedding,
    pHash,
    labels: visionData?.labels,
    objects: visionData?.objects,
  };
}

/**
 * Process multiple images to extract CLIP embeddings and pHashes
 * 
 * @param files - Array of image files
 * @param options - Processing options
 * @returns Array of processed images
 */
export async function processImages(
  files: File[],
  options: {
    clipApiEndpoint?: string;
    includeVisionLabels?: boolean;
    visionApiKey?: string;
    batchSize?: number; // Process in batches to avoid overwhelming the API
  } = {}
): Promise<ProcessedImage[]> {
  const {
    clipApiEndpoint,
    includeVisionLabels = false,
    visionApiKey,
    batchSize = 10, // Process 10 images at a time
  } = options;

  const results: ProcessedImage[] = [];

  // Process in batches to avoid overwhelming APIs
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    
    // Extract CLIP embeddings and pHashes in parallel for the batch
    const [clipResults, pHashResults, visionResults] = await Promise.all([
      extractCLIPEmbeddings(batch, clipApiEndpoint),
      processImageHashes(batch),
      includeVisionLabels && visionApiKey
        ? processImagesWithVision(batch, visionApiKey).catch(() => [])
        : Promise.resolve([]),
    ]);

    // Combine results - validate array lengths match
    if (clipResults.length !== batch.length || pHashResults.length !== batch.length) {
      throw new Error(
        `Batch processing error: result arrays length mismatch. ` +
        `Expected ${batch.length} results, got CLIP: ${clipResults.length}, pHash: ${pHashResults.length}`
      );
    }

    // Combine results
    for (let j = 0; j < batch.length; j++) {
      const clipResult = clipResults[j];
      const pHashResult = pHashResults[j];
      const visionResult = visionResults[j];

      results.push({
        file: clipResult.file,
        clipEmbedding: clipResult.embedding,
        pHash: pHashResult.hash,
        labels: visionResult?.labels,
        objects: visionResult?.objects,
      });
    }
  }

  return results;
}


