# Deployment Guide

## Overview

When deploying to Vercel, **only the frontend (Next.js) will be deployed**. The backend (FastAPI) needs to be deployed separately to a platform that supports Python applications.

## Architecture

```
┌─────────────┐         ┌──────────────┐
│   Vercel    │────────▶│   Backend    │
│  (Frontend) │  HTTP   │  (FastAPI)   │
│  Next.js    │         │   Python     │
└─────────────┘         └──────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │   Supabase   │
                        │  (Database & │
                        │   Storage)   │
                        └──────────────┘
```

## Backend Deployment Options

### Option 1: Railway (Recommended - Easiest)

**Pros:**
- Easy setup, connects to GitHub
- Automatic deployments
- Free tier available
- Good for Python/FastAPI

**Steps:**
1. Go to [railway.app](https://railway.app)
2. Create account and new project
3. Connect your GitHub repository
4. Click "Add Service" → "GitHub Repo"
5. Select your repository
6. **IMPORTANT:** In the service settings, go to "Settings" → "Root Directory" and set it to `backend`
7. **IMPORTANT:** Railway might detect Dockerfile - if build fails due to size, delete/rename the Dockerfile or Railway will use nixpacks.toml instead
8. Railway will auto-detect Python and deploy (using nixpacks.toml)
9. Get your backend URL from the "Settings" → "Domains" section

**Environment Variables:**

In Railway, go to your service → Variables tab and add:

- `ALLOWED_ORIGINS` - Your Vercel frontend URL(s), comma-separated
  - Example: `https://snaplyst-ai.vercel.app,https://your-custom-domain.com`
  - For local development, include: `http://localhost:3000,http://127.0.0.1:3000,https://snaplyst-ai.vercel.app`

- `SUPABASE_URL` - Your Supabase project URL
  - Example: `https://your-project.supabase.co`

- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (NOT the anon key!)
  - Get this from Supabase Dashboard → Settings → API → service_role key
  - ⚠️ **Important:** This key has admin access - keep it secret!

**Important:** After adding environment variables, Railway will automatically redeploy. Make sure the values match your Supabase project.

**Note:** The Dockerfile is intentionally ignored via `.dockerignore` to force Railway to use the optimized nixpacks build, which handles large dependencies better.

### Option 2: Render

**Pros:**
- Free tier available
- Easy Python deployment
- Automatic HTTPS

**Steps:**
1. Go to [render.com](https://render.com)
2. Create new Web Service
3. Connect GitHub repository
4. Settings:
   - **Build Command**: `cd backend && pip install -r requirements.txt`
   - **Start Command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Root Directory**: `backend`
5. Deploy

### Option 3: Fly.io

**Pros:**
- Global edge deployment
- Good performance
- Free tier available

**Steps:**
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Create `backend/fly.toml`:
   ```toml
   app = "your-app-name"
   primary_region = "iad"
   
   [build]
   
   [http_service]
     internal_port = 8000
     force_https = true
     auto_stop_machines = true
     auto_start_machines = true
     min_machines_running = 0
   
   [[vm]]
     cpu_kind = "shared"
     cpus = 1
     memory_mb = 256
   ```
3. Run: `fly launch` in backend directory
4. Deploy: `fly deploy`

### Option 4: Google Cloud Run / AWS Lambda / Azure Functions

**Pros:**
- Serverless, pay-per-use
- Auto-scaling

**Cons:**
- More complex setup
- Background removal may timeout (10-60s limits)
- May need optimization for serverless

**Note:** Background removal is CPU-intensive and may exceed serverless timeout limits. Consider these options only if you optimize the processing or use async processing.

## Frontend Deployment (Vercel)

### Steps:

1. **Push code to GitHub**

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Set root directory to `frontend/`

3. **Configure Environment Variables in Vercel:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   GOOGLE_VISION_API_KEY=your-google-vision-key
   NEXT_PUBLIC_API_URL=https://your-backend-url.com
   ```

4. **Deploy**

## Configuration Updates Needed

### 1. Update Backend CORS

Update `backend/app/main.py` to allow your Vercel domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://your-app.vercel.app",  # Add your Vercel URL
        "https://your-custom-domain.com",  # Add custom domain if used
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2. Update Frontend API URL

The frontend already uses `process.env.NEXT_PUBLIC_API_URL` with a fallback. Make sure to set this in Vercel environment variables.

### 3. Environment Variables Summary

**Frontend (Vercel):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_VISION_API_KEY` — server-only. Remove the old `NEXT_PUBLIC_GOOGLE_VISION_API_KEY` so the key is not shipped to the browser. Redeploy after the rename.
- `NEXT_PUBLIC_API_URL` (your backend URL)
- `MAINTENANCE_MODE` — optional

**Backend (Railway/Render/etc):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — used only after the caller's Supabase JWT matches `user_id`
- `ALLOWED_ORIGINS` — comma-separated frontend origins. `https://snaplyst-ai.vercel.app` is always allowed

## Testing Deployment

1. **Test Backend:**
   ```bash
   curl https://your-backend-url.com/health
   # Should return: {"status":"ok"}
   ```

2. **Test Frontend:**
   - Visit your Vercel URL
   - Try uploading an image
   - Try removing background (should call backend)

3. **Check Browser Console:**
   - Look for any CORS errors
   - Verify API calls are going to correct backend URL

## Troubleshooting

### CORS Errors
- Ensure backend CORS includes your Vercel domain
- Check backend logs for CORS rejection messages

### Backend Timeout
- Background removal can take 5-30 seconds
- Ensure your hosting platform allows long-running requests
- Consider increasing timeout limits

### Environment Variables Not Working
- Client-side variables need the `NEXT_PUBLIC_*` prefix. `GOOGLE_VISION_API_KEY` must stay without that prefix.
- Redeploy after adding or renaming environment variables
- Check Vercel dashboard → Settings → Environment Variables

### Backend Not Responding
- Check backend logs
- Verify backend URL is correct
- Test backend health endpoint directly

## Recommended Production Setup

1. **Frontend:** Vercel (automatic deployments from GitHub)
2. **Backend:** Railway or Render (easy Python deployment)
3. **Database/Storage:** Supabase (already configured)
4. **Monitoring:** Add logging/monitoring as needed

## Cost Estimate

- **Vercel:** Free tier (hobby) or $20/month (pro)
- **Railway:** Free tier (limited) or $5-20/month
- **Render:** Free tier (limited) or $7-25/month
- **Supabase:** Free tier (generous) or $25/month (pro)

**Total:** ~$0-50/month depending on usage and tier

