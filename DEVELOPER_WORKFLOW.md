# Snaplyst developer workflow

This is the current request path through the code. The portfolio overview, local setup, and test commands live in [README.md](README.md). Deployment steps live in [DEPLOYMENT.md](DEPLOYMENT.md).

There is no SQLAlchemy layer and no `backend/app/auth.py`, `models.py`, or `db.py`. Auth, listings, and file storage go through Supabase from the Next.js app. The Python service only removes backgrounds.

## What runs

| Process | Where | Role |
| --- | --- | --- |
| Next.js app | Vercel, local port 3000 | UI, Supabase client, `POST /api/vision` |
| Supabase | hosted project | Auth, Postgres, `product-images` bucket |
| FastAPI | Railway-style host, local port 8000 | `POST /api/background-removal/remove` |

`frontend/src/middleware.ts` only switches on the maintenance page. Route protection is the Supabase session in the pages themselves.

## Auth

Sign-in and sign-up call Supabase Auth from `frontend/src/lib/supabaseClient.ts` and `frontend/src/utils/auth.ts`. The session access token is what later calls send as `Authorization: Bearer …`.

- Vision: `POST /api/vision` checks the token with `GET {SUPABASE_URL}/auth/v1/user` before it spends the Google quota.
- Background removal: FastAPI calls `supabase.auth.get_user(token)` with the service-role client and requires the returned user id to equal the `user_id` in the body.

## Upload and grouping

`frontend/src/app/profile/page.tsx` handles the drop.

1. Read the session. Without an access token, the page stops with "Please sign in again before uploading photos."
2. `processImagesWithVision` posts each file's base64 content to `/api/vision`.
3. The route (`frontend/src/app/api/vision/route.ts`, helpers in `frontend/src/lib/visionServer.ts`) verifies the user, then calls Google with `GOOGLE_VISION_API_KEY`.
4. The browser turns labels and objects into a feature vector and groups similar photos with `groupSimilarImagesWithVision` (cosine similarity) in `frontend/src/lib/googleVision.ts`.
5. Each original is uploaded to `product-images` at `{userId}/{timestamp}_{uuid}.{ext}`.

The Google key is never read in client code and is not listed in `frontend/next.config.ts`.

## Background removal

`removeBackgroundFromImage` in `frontend/src/lib/api.ts` loads the session and posts `image_url`, `storage_path`, and `user_id` with the bearer token.

`backend/app/background_removal.py` then:

1. Requires `Authorization: Bearer <token>`. A missing or non-bearer header is 401 `Missing bearer token`.
2. Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. That 500 is returned as written, not wrapped in "Failed to process image".
3. Verifies the token. An invalid session is 401. A `user_id` that does not match is 403, and nothing is uploaded.
4. Requires `storage_path` to live under `{user_id}/`. A folderless name such as `photo.jpg` is 403. A `..` segment is 400.
5. Downloads the image, runs rembg `u2net`, and uploads `{stem}_bg_removed.png` beside the original.
6. Re-raises `HTTPException`. Download failures stay 400 `Failed to download image`. Unexpected errors stay 500 `Failed to process image`.

`build_processed_storage_path("photo.jpg")` returns `photo_bg_removed.png` with no leading slash. The endpoint still rejects that input because it is outside the user's folder. Real uploads already include the user id as the first segment.

`POST /api/background-removal/remove-batch` still returns base64 and does not upload with the service role key. It is not part of the product UI.

## CSV export

Depop and Shopify mappers live under `frontend/src/lib/export/`.

- Shopify variant grams treat `0` as a real weight. `variant.variantGrams != null` and `product.weight != null` both keep zero instead of falling through to an empty cell.
- `exportShopifyCsv` warns about a duplicate handle once per product, using the first row's handle. Extra image rows and extra variants of the same product repeat that handle on purpose and do not warn.

## Environment variables

Names only. Do not commit values.

**Vercel (frontend)**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`
- `GOOGLE_VISION_API_KEY` — server-only. Delete `NEXT_PUBLIC_GOOGLE_VISION_API_KEY` if it is still set.
- `MAINTENANCE_MODE` — optional

**Backend host**

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`

## Tests

```bash
cd frontend && pnpm test && pnpm lint
cd backend && ruff check . && pytest
```

CI runs the same checks from `.github/workflows/ci.yml`. Backend tests mock rembg, ONNX, and the Supabase client.
