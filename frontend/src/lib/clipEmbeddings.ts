/**
 * CLIP Embedding Extraction for Image Similarity
 * 
 * CLIP (Contrastive Language-Image Pre-training) provides 512-dimensional
 * embeddings that capture visual features like shape, texture, material,
 * color, style, and context - perfect for grouping images of the same product.
 * 
 * This module provides functions to extract CLIP embeddings from images.
 * You can run CLIP in:
 * - Supabase Edge Function (recommended)
 * - Vercel Serverless Function
 * - Local backend API
 * 
 * Expected response format from CLIP API:
 * {
 *   "embedding": [0.123, -0.456, ...] // 512 floats
 * }
 */

/**
 * Extract CLIP embedding from an image file
 * 
 * @param imageFile - The image file to process
 * @param apiEndpoint - URL to your CLIP embedding API endpoint
 * @returns 512-dimensional CLIP embedding vector
 */
export async function extractCLIPEmbedding(
  imageFile: File,
  apiEndpoint?: string
): Promise<number[]> {
  const endpoint = apiEndpoint || process.env.NEXT_PUBLIC_CLIP_API_ENDPOINT;
  
  if (!endpoint) {
    throw new Error(
      "CLIP API endpoint not configured. Please set NEXT_PUBLIC_CLIP_API_ENDPOINT " +
      "or provide apiEndpoint parameter. See CLIP_SETUP.md for instructions.\n" +
      "Example: NEXT_PUBLIC_CLIP_API_ENDPOINT=/api/clip-embedding"
    );
  }

  // Log the endpoint being used (for debugging)
  console.log('[CLIP] Using endpoint:', endpoint);
  console.log('[CLIP] Environment variable:', process.env.NEXT_PUBLIC_CLIP_API_ENDPOINT);

  // Convert file to base64
  const base64Image = await fileToBase64(imageFile);
  
  // Remove data URL prefix if present
  const base64Data = base64Image.includes(',') 
    ? base64Image.split(',')[1] 
    : base64Image;

  // Handle relative URLs (for Next.js API routes)
  // If endpoint starts with /, make it absolute using current origin
  const apiUrl = endpoint.startsWith('/') 
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${endpoint}`
    : endpoint;

  // Debug logging
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[CLIP] Calling endpoint:', apiUrl);
    console.log('[CLIP] Endpoint from env:', endpoint);
    console.log('[CLIP] Window origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A');
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Data,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMessage = `CLIP API error (${response.status}): ${errorText || response.statusText}`;
      
      // Provide helpful error messages
      if (response.status === 404) {
        throw new Error(
          `${errorMessage}\n\n` +
          `The endpoint "${apiUrl}" was not found. Please check:\n` +
          `1. NEXT_PUBLIC_CLIP_API_ENDPOINT is set to "/api/clip-embedding"\n` +
          `2. The API route exists at src/app/api/clip-embedding/route.ts\n` +
          `3. Restart your dev server after setting environment variables`
        );
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error("Invalid response format: expected { embedding: number[] }");
    }

    if (data.embedding.length !== 512) {
      throw new Error(
        `Invalid embedding dimension: expected 512, got ${data.embedding.length}`
      );
    }

    // Normalize the embedding vector (L2 normalization)
    return normalizeVector(data.embedding);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to extract CLIP embedding: ${String(error)}`);
  }
}

/**
 * Extract CLIP embeddings for multiple images
 * 
 * @param files - Array of image files
 * @param apiEndpoint - Optional CLIP API endpoint (uses env var if not provided)
 * @returns Array of embeddings with corresponding file info
 */
export async function extractCLIPEmbeddings(
  files: File[],
  apiEndpoint?: string
): Promise<Array<{ file: File; embedding: number[] }>> {
  // Process in parallel (CLIP API should handle concurrent requests)
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const embedding = await extractCLIPEmbedding(file, apiEndpoint);
        return { file, embedding };
      } catch (error) {
        console.error(`Failed to extract CLIP embedding for ${file.name}:`, error);
        throw error;
      }
    })
  );

  return results;
}

/**
 * Calculate cosine similarity between two CLIP embeddings
 * Returns a value between 0 and 1 (1 = identical, 0 = completely different)
 * 
 * @param embedding1 - First CLIP embedding (512D vector)
 * @param embedding2 - Second CLIP embedding (512D vector)
 * @returns Cosine similarity score (0-1)
 */
export function cosineSimilarityCLIP(
  embedding1: number[],
  embedding2: number[]
): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error(
      `Embedding dimension mismatch: ${embedding1.length} vs ${embedding2.length}`
    );
  }

  if (embedding1.length !== 512) {
    throw new Error(`Invalid CLIP embedding dimension: ${embedding1.length} (expected 512)`);
  }

  // Calculate dot product
  let dotProduct = 0;
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
  }

  // Since embeddings are normalized, dot product = cosine similarity
  // But let's verify normalization and calculate properly
  const magnitude1 = Math.sqrt(
    embedding1.reduce((sum, val) => sum + val * val, 0)
  );
  const magnitude2 = Math.sqrt(
    embedding2.reduce((sum, val) => sum + val * val, 0)
  );

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Normalize a vector to unit length (L2 normalization)
 */
function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(
    vector.reduce((sum, val) => sum + val * val, 0)
  );
  
  if (magnitude === 0) {
    return vector; // Zero vector, return as-is
  }
  
  return vector.map(val => val / magnitude);
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

