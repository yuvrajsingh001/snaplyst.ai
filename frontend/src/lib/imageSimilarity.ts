/**
 * Image Similarity Matching using Perceptual Hash (pHash)
 * Groups similar images based on perceptual hash comparison
 */

/**
 * Calculate perceptual hash of an image
 * Uses a simplified pHash algorithm that works in the browser
 */
export async function calculateImageHash(imageFile: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      try {
        // Resize to 8x8 for hash calculation (standard pHash size)
        canvas.width = 8;
        canvas.height = 8;
        ctx.drawImage(img, 0, 0, 8, 8);

        // Get image data
        const imageData = ctx.getImageData(0, 0, 8, 8);
        const pixels = imageData.data;

        // Convert to grayscale and calculate average
        let sum = 0;
        const grayscale: number[] = [];

        for (let i = 0; i < pixels.length; i += 4) {
          // Calculate grayscale value (weighted average)
          const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
          grayscale.push(gray);
          sum += gray;
        }

        const average = sum / grayscale.length;

        // Generate hash: 1 if pixel > average, 0 otherwise
        let hash = '';
        for (const gray of grayscale) {
          hash += gray > average ? '1' : '0';
        }

        resolve(hash);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(imageFile);
  });
}

/**
 * Calculate Hamming distance between two hashes
 * Returns a value between 0 and 1 (0 = identical, 1 = completely different)
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return 1; // Different lengths = completely different
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }

  return distance / hash1.length;
}

/**
 * Calculate similarity percentage from Hamming distance
 * Similarity = (1 - Hamming distance) * 100
 */
export function calculateSimilarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2);
  return (1 - distance) * 100;
}

/**
 * Group images by similarity
 * Images with similarity > threshold are grouped together
 * Uses a stricter algorithm: images must be similar to ALL images in the group
 */
export function groupSimilarImages(
  images: Array<{ id: string; hash: string; file: File }>,
  threshold: number = 50
): Array<Array<{ id: string; hash: string; file: File }>> {
  const groups: Array<Array<{ id: string; hash: string; file: File }>> = [];
  const processed = new Set<string>();

  for (let i = 0; i < images.length; i++) {
    if (processed.has(images[i].id)) continue;

    const group = [images[i]];
    processed.add(images[i].id);

    // Find images that are similar to ALL images in the current group
    // This is stricter - prevents unrelated images from being grouped
    for (let j = i + 1; j < images.length; j++) {
      if (processed.has(images[j].id)) continue;

      // Check if this image is similar to ALL images in the current group
      let isSimilarToAll = true;
      for (const groupImage of group) {
        const similarity = calculateSimilarity(groupImage.hash, images[j].hash);
        if (similarity < threshold) {
          isSimilarToAll = false;
          break;
        }
      }

      if (isSimilarToAll) {
        group.push(images[j]);
        processed.add(images[j].id);
      }
    }

    // Only create a group if it has more than 1 image, or if it's a single unique image
    if (group.length > 1) {
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Process multiple images and calculate their hashes
 */
export async function processImageHashes(
  files: File[]
): Promise<Array<{ file: File; hash: string }>> {
  const results = await Promise.all(
    files.map(async (file) => {
      const hash = await calculateImageHash(file);
      return { file, hash };
    })
  );

  return results;
}

