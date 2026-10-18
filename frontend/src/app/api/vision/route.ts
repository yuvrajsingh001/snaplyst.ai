import { NextResponse } from "next/server";
import { annotateImage, supabaseUserId } from "@/lib/visionServer";

function bearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function POST(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const userId = await supabaseUserId(token);
  if (!userId) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Vision is not configured. Set GOOGLE_VISION_API_KEY on the server." },
      { status: 500 },
    );
  }

  let body: { content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.content !== "string" || !body.content) {
    return NextResponse.json({ error: "Image content is required" }, { status: 400 });
  }

  try {
    const analysis = await annotateImage(body.content, apiKey);
    return NextResponse.json(analysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vision request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
