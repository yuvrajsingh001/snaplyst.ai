import { NextRequest, NextResponse } from 'next/server';

// Route segment config - ensure this route is handled correctly
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Explicitly allow POST method for Vercel
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * CLIP Embedding API Route
 * 
 * Extracts CLIP embeddings from images using Hugging Face Inference API.
 * This endpoint is used by the frontend to get 512-dimensional embeddings
 * for image similarity matching.
 * 
 * POST /api/clip-embedding
 * Body: { image: string } // base64 image string (without data:image/... prefix)
 * Response: { embedding: number[] } // 512-dimensional vector
 */
export async function POST(req: NextRequest) {
  // Enhanced logging for Vercel debugging
  console.log('[CLIP API] ===== POST request received =====');
  console.log('[CLIP API] URL:', req.url);
  console.log('[CLIP API] Method:', req.method);
  console.log('[CLIP API] Headers:', Object.fromEntries(req.headers.entries()));
  
  try {
    const body = await req.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      );
    }

    // Get Hugging Face API key from environment variables
    const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
    
    if (!huggingFaceApiKey) {
      return NextResponse.json(
        { error: 'HUGGINGFACE_API_KEY is not configured. Please set it in your environment variables.' },
        { status: 500 }
      );
    }

    // Validate token format (should start with hf_)
    if (!huggingFaceApiKey.startsWith('hf_')) {
      return NextResponse.json(
        { error: 'Invalid Hugging Face API key format. Token should start with "hf_". Please check your HUGGINGFACE_API_KEY.' },
        { status: 500 }
      );
    }

    // Call Hugging Face CLIP model API using router endpoint
    // Note: api-inference.huggingface.co is deprecated, must use router.huggingface.co
    const modelName = "sentence-transformers/clip-ViT-B-32";
    
    // Use the new router endpoint format: router.huggingface.co/hf-inference/{model}
    // This is the correct format for the new Inference Providers system
    const routerUrl = `https://router.huggingface.co/hf-inference/${modelName}`;
    
    // Prepare request body for router API
    // The router API expects the image as base64 in the inputs field
    const requestBody = {
      inputs: image, // base64 image string
    };
    
    let response: Response;
    
    try {
      // Add timeout to fetch (30 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      response = await fetch(routerUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${huggingFaceApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError) {
      console.error('Fetch error details:', fetchError);
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      
      // Check if it's a timeout
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout: Hugging Face API took too long to respond (30s limit)' },
          { status: 504 }
        );
      }
      
      return NextResponse.json(
        { 
          error: `Failed to connect to Hugging Face API: ${errorMessage}. Please check your network connection and API key.` 
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Hugging Face API error (${response.status})`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      // Handle specific error cases
      if (response.status === 503) {
        errorMessage = "Hugging Face model is loading. Please wait a moment and try again.";
      } else if (response.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (response.status === 410) {
        errorMessage = "The Hugging Face API endpoint format has changed. Please update your code to use router.huggingface.co (this should already be done).";
      } else if (response.status === 401 || response.status === 403) {
        errorMessage = "Authentication failed. Please check your HUGGINGFACE_API_KEY is valid and has the correct permissions.";
      }

      // Log the full error for debugging
      console.error(`[CLIP] Hugging Face API error (${response.status}):`, errorMessage);
      console.error(`[CLIP] Response body:`, errorText);

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Hugging Face returns the embedding array directly (or wrapped)
    // Handle both formats
    let embedding: number[] | undefined;
    
    if (Array.isArray(data)) {
      embedding = data;
    } else if (data.embedding && Array.isArray(data.embedding)) {
      embedding = data.embedding;
    } else if (data[0] && Array.isArray(data[0])) {
      // Sometimes wrapped in an array
      embedding = data[0];
    } else {
      return NextResponse.json(
        { error: 'Invalid response format from Hugging Face API' },
        { status: 500 }
      );
    }
    
    // Validate embedding exists and has correct dimension (must be 512 for CLIP-ViT-B-32)
    if (!embedding || !Array.isArray(embedding) || embedding.length !== 512) {
      return NextResponse.json(
        { 
          error: `Invalid embedding dimension: expected 512D vector, got ${embedding ? embedding.length : 0}D` 
        },
        { status: 500 }
      );
    }

    // Return the embedding
    return NextResponse.json({ embedding });
  } catch (error) {
    console.error('CLIP embedding error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred while processing CLIP embedding';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log full error details for debugging
    console.error('Full error details:', {
      message: errorMessage,
      stack: errorStack,
      error: error
    });
    
    return NextResponse.json(
      { 
        error: errorMessage,
        // Include stack trace in development only
        ...(process.env.NODE_ENV === 'development' && errorStack ? { stack: errorStack } : {})
      },
      { status: 500 }
    );
  }
}

// Handle GET requests (for testing)
export async function GET() {
  return NextResponse.json(
    { 
      message: 'CLIP Embedding API is running',
      endpoint: '/api/clip-embedding',
      method: 'POST',
      body: { image: 'base64_string' }
    },
    { status: 200 }
  );
}

