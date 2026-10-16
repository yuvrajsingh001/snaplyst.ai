/**
 * Google Vision API Integration for Image Similarity Matching
 * Uses Google Cloud Vision API to extract image features and compare them
 */

/**
 * Get image features using Google Vision API
 * Returns image labels, objects, and other features for similarity comparison
 */
export async function analyzeImageWithVision(
  imageFile: File,
  apiKey = process.env.NEXT_PUBLIC_GOOGLE_VISION_API_KEY
): Promise<{
  labels: Array<{ description: string; score: number }>;
  objects: Array<{ name: string; score: number }>;
  features: number[]; // Normalized feature vector for similarity
}> {
  // Convert file to base64
  const base64Image = await fileToBase64(imageFile);

  // Call Google Vision API
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Image.split(',')[1], // Remove data:image/... prefix
            },
            features: [
              {
                type: 'LABEL_DETECTION',
                maxResults: 20,
              },
              {
                type: 'OBJECT_LOCALIZATION',
                maxResults: 20,
              },
              {
                type: 'IMAGE_PROPERTIES',
                maxResults: 1,
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    let errorMessage = '';
    try {
      const error = await response.json();
      errorMessage = error.error?.message || response.statusText;
      
      // Provide helpful error messages for common issues
      if (errorMessage.includes('blocked') || errorMessage.includes('API method') || errorMessage.includes('not enabled')) {
        errorMessage = `Google Vision API is blocked or not enabled. Please:\n` +
          `1. Enable Cloud Vision API in Google Cloud Console\n` +
          `2. Check API key restrictions\n` +
          `3. Ensure billing is enabled (free tier available)\n` +
          `See GOOGLE_VISION_TROUBLESHOOTING.md for details.\n\n` +
          `Original error: ${error.error?.message || response.statusText}`;
      } else if (errorMessage.includes('API key not valid') || errorMessage.includes('invalid API key')) {
        errorMessage = `Invalid Google Vision API key. Please check your NEXT_PUBLIC_GOOGLE_VISION_API_KEY in .env file.`;
      } else if (errorMessage.includes('quota') || errorMessage.includes('Quota')) {
        errorMessage = `Google Vision API quota exceeded. Free tier: 1,000 requests/month.`;
      }
    } catch (e) {
      errorMessage = `Google Vision API error: ${response.statusText} (Status: ${response.status})`;
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return analysisFromVisionAnnotations(data.responses[0]);
}

type VisionLabel = { description: string; score: number };
type VisionObject = { name: string; score: number };

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
  // Extract labels
  const labels =
    annotations.labelAnnotations?.map((label) => ({
      description: label.description,
      score: label.score,
    })) || [];

  // Extract objects
  const objects =
    annotations.localizedObjectAnnotations?.map((obj) => ({
      name: obj.name,
      score: obj.score,
    })) || [];

  // Create feature vector from labels and objects for similarity comparison
  // Combine label scores and object scores into a normalized vector
  const allFeatures: { [key: string]: number } = {};

  // Add label features
  labels.forEach((label) => {
    allFeatures[`label_${label.description.toLowerCase()}`] = label.score;
  });

  // Add object features
  objects.forEach((obj) => {
    allFeatures[`object_${obj.name.toLowerCase()}`] = obj.score;
  });

  // Convert to array (normalized feature vector)
  const featureVector = Object.values(allFeatures);
  const magnitude = Math.sqrt(featureVector.reduce((sum, val) => sum + val * val, 0));
  const normalizedFeatures = magnitude > 0
    ? featureVector.map((val) => val / magnitude)
    : featureVector;

  return {
    labels,
    objects,
    features: normalizedFeatures,
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
  apiKey: string
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
      const analysis = await analyzeImageWithVision(file, apiKey);
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

