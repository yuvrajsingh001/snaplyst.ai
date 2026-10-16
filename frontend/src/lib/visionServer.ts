type VisionLabel = { description: string; score: number };
type VisionObject = { name: string; score: number };

type GoogleErrorBody = {
  error?: {
    message?: string;
  };
};

export function friendlyVisionError(
  status: number,
  statusText: string,
  payload: unknown,
): string {
  const apiMessage =
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as GoogleErrorBody).error?.message === "string"
      ? (payload as GoogleErrorBody).error?.message || ""
      : "";

  if (!apiMessage) {
    return `Google Vision API error: ${statusText} (Status: ${status})`;
  }
  if (
    apiMessage.includes("blocked") ||
    apiMessage.includes("API method") ||
    apiMessage.includes("not enabled")
  ) {
    return (
      "Google Vision API is blocked or not enabled. Please:\n" +
      "1. Enable Cloud Vision API in Google Cloud Console\n" +
      "2. Check API key restrictions\n" +
      "3. Ensure billing is enabled (free tier available)\n\n" +
      `Original error: ${apiMessage}`
    );
  }
  if (apiMessage.includes("API key not valid") || apiMessage.includes("invalid API key")) {
    return "Invalid Google Vision API key. Set GOOGLE_VISION_API_KEY on the server.";
  }
  if (apiMessage.toLowerCase().includes("quota")) {
    return "Google Vision API quota exceeded. Free tier: 1,000 requests/month.";
  }
  return apiMessage;
}

export async function supabaseUserId(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const response = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
  });
  if (!response.ok) return null;
  const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
  return body && typeof body.id === "string" && body.id ? body.id : null;
}

export async function annotateImage(
  content: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ labels: VisionLabel[]; objects: VisionObject[] }> {
  const response = await fetchImpl(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content },
            features: [
              { type: "LABEL_DETECTION", maxResults: 20 },
              { type: "OBJECT_LOCALIZATION", maxResults: 20 },
              { type: "IMAGE_PROPERTIES", maxResults: 1 },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new Error(friendlyVisionError(response.status, response.statusText, payload));
  }

  const data = (await response.json()) as {
    responses?: Array<{
      labelAnnotations?: Array<{ description?: string; score?: number }>;
      localizedObjectAnnotations?: Array<{ name?: string; score?: number }>;
    }>;
  };
  const annotations = data.responses?.[0] ?? {};
  const labels = (annotations.labelAnnotations ?? [])
    .filter((label) => typeof label.description === "string")
    .map((label) => ({
      description: label.description as string,
      score: typeof label.score === "number" ? label.score : 0,
    }));
  const objects = (annotations.localizedObjectAnnotations ?? [])
    .filter((object) => typeof object.name === "string")
    .map((object) => ({
      name: object.name as string,
      score: typeof object.score === "number" ? object.score : 0,
    }));
  return { labels, objects };
}
