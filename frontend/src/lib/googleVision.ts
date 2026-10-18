/**
 * Google Vision API Integration for Image Similarity Matching
 * Uses Google Cloud Vision API to extract image features and compare them
 */

type VisionLabel = { description: string; score: number };
type VisionObject = { name: string; score: number };

/**
 * Normalized feature vector from Vision labels and objects.
 * Label and object names are namespaced so they do not collide.
 */
export function featuresFromAnnotations(
  labels: VisionLabel[],
  objects: VisionObject[],
): number[] {
  const allFeatures: { [key: string]: number } = {};
  labels.forEach((label) => {
    allFeatures[`label_${label.description.toLowerCase()}`] = label.score;
  });
  objects.forEach((object) => {
    allFeatures[`object_${object.name.toLowerCase()}`] = object.score;
  });
  const featureVector = Object.values(allFeatures);
  const magnitude = Math.sqrt(featureVector.reduce((sum, value) => sum + value * value, 0));
  return magnitude > 0 ? featureVector.map((value) => value / magnitude) : featureVector;
}

/**
 * Turn a Cloud Vision annotate response into the feature vector the sorter uses.
 * Shared by the browser call and the metered guest call.
 */
export function analysisFromVisionAnnotations(annotations: {
  labelAnnotations?: VisionLabel[];
  localizedObjectAnnotations?: VisionObject[];
}): {
  labels: VisionLabel[];
  objects: VisionObject[];
  features: number[];
} {
  const labels =
    annotations.labelAnnotations?.map((label) => ({
      description: label.description,
      score: label.score,
    })) || [];

  const objects =
    annotations.localizedObjectAnnotations?.map((obj) => ({
      name: obj.name,
      score: obj.score,
    })) || [];

  return {
    labels,
    objects,
    features: featuresFromAnnotations(labels, objects),
  };
}

/**
 * Ask the Next.js server route to call Google Vision.
 * The API key never reaches the browser.
 */
export async function analyzeImageWithVision(
  imageFile: File,
  accessToken: string,
): Promise<{
  labels: VisionLabel[];
  objects: VisionObject[];
  features: number[];
}> {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  const base64Image = await fileToBase64(imageFile);
  const content = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
  const response = await fetch("/api/vision", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ content }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    labels?: VisionLabel[];
    objects?: VisionObject[];
  };
  if (!response.ok) {
    throw new Error(payload.error || `Vision request failed (${response.status})`);
  }

  const labels = Array.isArray(payload.labels) ? payload.labels : [];
  const objects = Array.isArray(payload.objects) ? payload.objects : [];
  return {
    labels,
    objects,
    features: featuresFromAnnotations(labels, objects),
  };
}

/**
 * Convert File to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Calculate cosine similarity between two feature vectors
 * Returns a value between 0 and 1 (1 = identical, 0 = completely different)
 */
export function cosineSimilarity(
  features1: number[],
  features2: number[]
): number {
  if (features1.length !== features2.length) {
    return 0; // Different dimensions = no similarity
  }

  // Calculate dot product
  let dotProduct = 0;
  for (let i = 0; i < features1.length; i++) {
    dotProduct += features1[i] * features2[i];
  }

  // Calculate magnitudes
  const magnitude1 = Math.sqrt(
    features1.reduce((sum, val) => sum + val * val, 0)
  );
  const magnitude2 = Math.sqrt(
    features2.reduce((sum, val) => sum + val * val, 0)
  );

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calculate similarity percentage from cosine similarity
 */
export function calculateSimilarityPercentage(
  features1: number[],
  features2: number[]
): number {
  const similarity = cosineSimilarity(features1, features2);
  return similarity * 100; // Convert to percentage
}

/**
 * Group images by similarity using Google Vision features
 */
export function groupSimilarImagesWithVision(
  images: Array<{
    id: string;
    features: number[];
    labels: Array<{ description: string; score: number }>;
    file: File;
  }>,
  threshold: number = 50
): Array<Array<{ id: string; features: number[]; labels: Array<{ description: string; score: number }>; file: File }>> {
  const groups: Array<Array<{ id: string; features: number[]; labels: Array<{ description: string; score: number }>; file: File }>> = [];
  const processed = new Set<string>();

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
        const similarity = calculateSimilarityPercentage(
          groupImage.features,
          images[j].features
        );
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

    // Only create a group if it has more than 1 image
    if (group.length > 1) {
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Process multiple images with Google Vision API
 */
export async function processImagesWithVision(
  files: File[],
  accessToken: string,
): Promise<
  Array<{
    file: File;
    features: number[];
    labels: Array<{ description: string; score: number }>;
    objects: Array<{ name: string; score: number }>;
  }>
> {
  const results = await Promise.all(
    files.map(async (file) => {
      const analysis = await analyzeImageWithVision(file, accessToken);
      return {
        file,
        features: analysis.features,
        labels: analysis.labels,
        objects: analysis.objects,
      };
    })
  );

  return results;
}
