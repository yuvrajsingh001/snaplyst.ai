# Snaplyst

[![CI](https://github.com/yuvrajsingh001/snaplyst.ai/actions/workflows/ci.yml/badge.svg)](https://github.com/yuvrajsingh001/snaplyst.ai/actions/workflows/ci.yml)

Snaplyst is a cross-listing workspace for resellers: group product photos into listings, strip backgrounds, and export ready-to-upload CSVs for Depop and Shopify.

**Live demo:** [https://snaplyst-ai.vercel.app](https://snaplyst-ai.vercel.app)

## Demo

> **TODO (demo media):** Add a short GIF or MP4 of the real product flow before sharing this repo widely.
>
> Suggested capture: sign in on the live app, drop a few product photos, sort them into a stack, remove a background, then export a Depop or Shopify CSV.
>
> When the file is in the repo, embed it here:
>
> `![Snaplyst product demo](docs/demo.gif)`
>
> or `<video src="docs/demo.mp4" controls></video>`

## Features

- Email sign-up and sign-in through Supabase Auth, with per-user product data protected by row-level security
- Drag-and-drop photo upload into a private `product-images` storage bucket
- Automatic grouping of similar photos into product stacks, using Google Cloud Vision labels and cosine similarity
- One-click background removal (and undo) via a FastAPI service running rembg / ONNX
- Listing fields for price, brand, condition, size, colour, and channel-specific Depop and Shopify settings
- CSV export that follows the official Depop and Shopify templates, including multi-image and multi-variant Shopify rows

## Architecture

The browser talks to Supabase for auth, data, and file storage, calls Google Vision directly for similarity, and calls the Python service only for background removal. The Python service downloads the original, runs the model, and writes the PNG back to storage with the service role key.

```mermaid
flowchart LR
  Browser["Next.js frontend<br/>snaplyst-ai.vercel.app"]
  Auth["Supabase Auth"]
  DB["Supabase Postgres<br/>profiles, product_stacks, product_images"]
  Store["Supabase Storage<br/>bucket: product-images"]
  Vision["Google Cloud Vision"]
  API["FastAPI service<br/>POST /api/background-removal/remove"]
  Model["rembg + ONNX<br/>u2net"]

  Browser -->|"sign in, session"| Auth
  Browser -->|"CRUD listings<br/>owner-scoped"| DB
  Browser -->|"upload originals<br/>read public URLs"| Store
  Browser -->|"labels, objects, features"| Vision
  Browser -->|"image_url, storage_path, user_id"| API
  API -->|"download original"| Store
  API --> Model
  API -->|"upload PNG<br/>service role"| Store
  API -->|"processed_storage_path"| Browser
  Browser -->|"point the row at the PNG"| DB
```

Background removal request path:

1. The frontend checks storage for an existing `*_bg_removed.png` and reuses it when present.
2. Otherwise it `POST`s the public image URL plus the original storage path to `/api/background-removal/remove`.
3. FastAPI downloads the bytes, runs `rembg` with the `u2net` session, and uploads a PNG to the same folder.
4. The frontend saves `processed_storage_path` on the `product_images` row. Undo restores the original path and keeps the PNG for the next time.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, TanStack Query |
| Auth, database, storage | Supabase (Postgres, Auth, Storage) |
| Background removal | FastAPI, rembg, ONNX Runtime, Pillow |
| Image similarity | Google Cloud Vision API, cosine similarity in the browser |
| CSV export | Papa Parse, plus SheetJS for `.xlsx` templates |
| Hosting | Vercel (frontend), Railway-style Python host (API) |
| Tests | Vitest + Testing Library, pytest |
| CI | GitHub Actions, ESLint, Ruff |

## Local setup

Prerequisites: Node.js 20+, pnpm 10, Python 3.11+.

### Frontend

```bash
cd frontend
pnpm install
```

Create `frontend/.env.local` with these names (values stay out of git):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_VISION_API_KEY`
- `NEXT_PUBLIC_API_URL` — base URL of the FastAPI service, with no trailing path
- `MAINTENANCE_MODE` — optional; set to `true` to serve the maintenance page

```bash
pnpm dev
```

The app runs at `http://localhost:3000`. Supabase project setup is in [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Deployment notes are in [DEPLOYMENT.md](DEPLOYMENT.md).

### Backend

The API is only required for background removal. Listing, auth, and export work against Supabase without it.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env` (or export the variables) with these names only:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — server-side key; never expose this to the browser
- `ALLOWED_ORIGINS` — comma-separated frontend origins. `https://snaplyst-ai.vercel.app` is always allowed

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: `http://localhost:8000/health`
- Interactive docs: `http://localhost:8000/docs`

`requirements.txt` installs rembg and ONNX Runtime, which are large. The test requirements below do not.

## Tests

CI lints and tests both apps. Background-removal tests mock rembg, ONNX, and the Supabase client, so they do not download models.

```bash
# Frontend unit tests and lint
cd frontend
pnpm test
pnpm lint

# Backend unit tests and lint
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
ruff check .
pytest
```

## Roadmap

- Authenticate `POST /api/background-removal/remove` against the caller's Supabase session. `user_id` is accepted today and not checked.
- Move Google Vision calls server-side so the API key is not shipped to the browser.
- Add eBay and Poshmark export templates next to Depop and Shopify.
- Queue batch background removal with per-image progress instead of sequential browser requests.
- Suggest price, title, and category from the Vision labels already stored on each photo.

## Project layout

```
frontend/     Next.js app (App Router)
backend/      FastAPI background-removal service
.github/      GitHub Actions CI
```

`DEVELOPER_WORKFLOW.md` is a longer internal walkthrough. Parts of it predate background removal and still mention a SQLAlchemy auth API that has since been removed; the diagram above matches the code that ships today.
