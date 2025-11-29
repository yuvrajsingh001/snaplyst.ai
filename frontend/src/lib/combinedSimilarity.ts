/**
 * Combined Similarity Matching: CLIP + pHash
 * 
 * This module combines CLIP embeddings (70%) and perceptual hash (30%)
 * for maximum reliability in product grouping.
 * 
 * CLIP captures:
 * - Object shape, angles, texture, material, color, style, context
 * 
 * pHash captures:
 * - Near-duplicate detection, exact matches, minor variations
 * 
 * Together they provide Amazon-level product grouping accuracy.
 */

import { cosineSimilarityCLIP } from "./clipEmbeddings";
import { calculateSimilarity as calculatePHashSimilarity } from "./imageSimilarity";

/**
 * Calculate combined similarity score
 * 
 * @param clipEmbedding1 - First CLIP embedding (512D vector)
 * @param clipEmbedding2 - Second CLIP embedding (512D vector)
 * @param pHash1 - First perceptual hash string
 * @param pHash2 - Second perceptual hash string
 * @param clipWeight - Weight for CLIP similarity (default 0.7)
 * @param pHashWeight - Weight for pHash similarity (default 0.3)
 * @returns Combined similarity score (0-1)
 */
export function calculateCombinedSimilarity(
  clipEmbedding1: number[],
  clipEmbedding2: number[],
  pHash1: string,
  pHash2: string,
  clipWeight: number = 0.7,
  pHashWeight: number = 0.3
): number {
  // Validate weights sum to 1
  if (Math.abs(clipWeight + pHashWeight - 1.0) > 0.001) {
    throw new Error("clipWeight + pHashWeight must equal 1.0");
  }

  // Calculate CLIP similarity (0-1)
  const clipSimilarity = cosineSimilarityCLIP(clipEmbedding1, clipEmbedding2);
  
  // Calculate pHash similarity (0-1, from percentage)
  const pHashSim = calculatePHashSimilarity(pHash1, pHash2) / 100;

  // Weighted combination
  const combinedSimilarity = 
    clipSimilarity * clipWeight + 
    pHashSim * pHashWeight;

  return Math.max(0, Math.min(1, combinedSimilarity)); // Clamp to [0, 1]
}

/**
 * Calculate combined similarity percentage
 * 
 * @param clipEmbedding1 - First CLIP embedding (512D vector)
 * @param clipEmbedding2 - Second CLIP embedding (512D vector)
 * @param pHash1 - First perceptual hash string
 * @param pHash2 - Second perceptual hash string
 * @returns Combined similarity percentage (0-100)
 */
export function calculateCombinedSimilarityPercentage(
  clipEmbedding1: number[],
  clipEmbedding2: number[],
  pHash1: string,
  pHash2: string,
  clipWeight: number = 0.7,
  pHashWeight: number = 0.3
): number {
  const similarity = calculateCombinedSimilarity(
    clipEmbedding1,
    clipEmbedding2,
    pHash1,
    pHash2,
    clipWeight,
    pHashWeight
  );
  return similarity * 100;
}

/**
 * Group images by combined similarity (CLIP + pHash)
 * 
 * Uses cosine similarity with threshold ~0.75 for CLIP (equivalent to 75% similarity)
 * 
 * @param images - Array of images with CLIP embeddings and pHash
 * @param threshold - Similarity threshold (0-100, default 75)
 * @param clipWeight - Weight for CLIP similarity (default 0.7)
 * @param pHashWeight - Weight for pHash similarity (default 0.3)
 * @returns Array of image groups
 */
export function groupSimilarImagesCombined<T extends {
  id: string;
  clipEmbedding: number[];
  pHash: string;
}>(
  images: T[],
  threshold: number = 75,
  clipWeight: number = 0.7,
  pHashWeight: number = 0.3
): T[][] {
  const groups: T[][] = [];
  const processed = new Set<string>();

  // Convert threshold percentage to decimal for comparison
  const thresholdDecimal = threshold / 100;

  for (let i = 0; i < images.length; i++) {
    if (processed.has(images[i].id)) continue;

    const group = [images[i]];
    processed.add(images[i].id);

    // Find images that are similar to ALL images in the current group
    for (let j = i + 1; j < images.length; j++) {
      if (processed.has(images[j].id)) continue;

      // Check if this image is similar to ALL images in the current group
      let isSimilarToAll = true;
      for (const groupImage of group) {
        const similarity = calculateCombinedSimilarity(
          groupImage.clipEmbedding,
          images[j].clipEmbedding,
          groupImage.pHash,
          images[j].pHash,
          clipWeight,
          pHashWeight
        );

        if (similarity < thresholdDecimal) {
          isSimilarToAll = false;
          break;
        }
      }

      if (isSimilarToAll) {
        group.push(images[j]);
        processed.add(images[j].id);
      }
    }

    // Only create a group if it has more than 1 image
    if (group.length > 1) {
      groups.push(group);
    }
  }

  return groups;
}

