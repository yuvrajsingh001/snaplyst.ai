# Snaplyst Developer Workflow Documentation

## Overview

Snaplyst is a full-stack web application for organizing product images into "stacks" (groups) using AI-powered image similarity detection. The application uses a modern architecture with a Next.js frontend and a FastAPI backend, both connected to Supabase for authentication, database, and storage.

---

## Architecture Overview

```
┌─────────────────┐
│   Browser       │
│  (Next.js App)  │
└────────┬────────┘
         │
         ├───► Supabase (Auth, Database, Storage)
         │
         ├───► Google Vision API (Image Analysis)
         │
         └───► FastAPI Backend (Optional - Currently Minimal)
```

### Key Technologies

- **Frontend**: Next.js 16 (React 19), TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python), SQLAlchemy
- **Database**: PostgreSQL (via Supabase)
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth
- **Image Analysis**: Google Cloud Vision API
- **Package Manager**: pnpm

---

## Frontend Architecture

### Services Running

1. **Next.js Development Server** (`pnpm dev`)
   - Port: `3000`
   - Hot module replacement (HMR)
   - Server-side rendering (SSR)
   - API routes (if any)

### Key Processes

#### 1. **Authentication Flow** (`src/app/page.tsx`, `src/utils/auth.ts`)

**Process:**
1. User visits homepage (`/`)
2. App checks for existing Supabase session
3. If authenticated → redirect to `/profile`
4. If not authenticated → show login/signup form
5. On login/signup:
   - Frontend calls Supabase Auth API directly
   - Supabase handles password hashing, JWT tokens
   - Session stored in browser (localStorage/cookies)
   - Auth state listener updates UI automatically

**Files:**
- `src/lib/supabaseClient.ts` - Supabase client initialization
- `src/utils/auth.ts` - Auth utility functions
- `src/app/page.tsx` - Login/signup page
- `src/middleware.ts` - Route protection (currently only maintenance mode)

**Key Functions:**
- `supabase.auth.signInWithPassword()` - Login
- `supabase.auth.signUp()` - Signup
- `supabase.auth.getSession()` - Check session
- `supabase.auth.onAuthStateChange()` - Listen for auth changes

#### 2. **Profile Page** (`src/app/profile/page.tsx`)

**Main Features:**
- Image upload via drag-and-drop (react-dropzone)
- Image analysis using Google Vision API
- Automatic grouping of similar images into "stacks"
- Display of stacks with header images
- View unsorted images

**Process Flow:**

1. **User Authentication Check**
   ```
   useEffect → Check Supabase session → Redirect if not authenticated
   ```

2. **Image Upload Process** (`onDrop` callback)
   ```
   User drops files
   ↓
   Process images with Google Vision API (extract features, labels, objects)
   ↓
   For each image:
     - Generate unique filename: {userId}/{timestamp}_{uuid}.{ext}
     - Upload to Supabase Storage bucket "product-images"
     - Create product_image record in database (stack_id = null)
     - Store Vision API features in metadata JSON field
   ↓
   Reload unsorted images list
   ```

3. **Image Sorting/Grouping Process** (`handleSortImages`)
   ```
   Fetch all unsorted images (stack_id IS NULL)
   ↓
   For each image:
     - Extract stored features from metadata
     - Calculate cosine similarity between all image pairs
     - Group images with similarity > threshold (default 50%)
   ↓
   For each group:
     - Create a new "product_stack" record
     - Assign all images in group to that stack
     - Update product_image records with stack_id
   ↓
   Reload stacks and unsorted images
   ```

4. **Stack Management**
   - View all stacks with header images
   - Click stack to view details (`/stack/[id]`)
   - Delete stacks (cascades to images)
   - Clear all stacks

**Key Functions Used:**
- `processImagesWithVision()` - Analyze images with Google Vision
- `groupSimilarImagesWithVision()` - Group similar images
- `uploadToSupabaseStorage()` - Upload to Supabase Storage
- `createProductImage()` - Create database record
- `createStack()` - Create new stack
- `assignImageToStack()` - Assign image to stack
- `getStacks()` - Fetch user's stacks
- `getUnsortedImages()` - Fetch images without stack

#### 3. **Stack Detail Page** (`src/app/stack/[id]/page.tsx`)

**Process:**
1. Verify user owns the stack (RLS policy check)
2. Load stack details (title, description, price, currency)
3. Load all images in the stack
4. Generate signed URLs for images from Supabase Storage
5. Display images in horizontal gallery
6. Allow editing description and price
7. Save updates to database

**Key Functions:**
- `getStack()` - Fetch stack details
- `getStackImages()` - Fetch images in stack
- `updateStack()` - Update stack metadata
- `supabase.storage.from("product-images").getPublicUrl()` - Get image URLs

#### 4. **API Layer** (`src/lib/api.ts`)

**Purpose:** Abstraction layer for all Supabase operations

**Key Functions:**
- `ensureUserExists()` - Creates profile record if missing (required for RLS)
- `createStack()` - Creates product_stack record
- `getStacks()` - Fetches all user's stacks with image counts
- `getStack()` - Fetches single stack
- `updateStack()` - Updates stack metadata
- `uploadToSupabaseStorage()` - Uploads file to Supabase Storage
- `createProductImage()` - Creates product_image record
- `assignImageToStack()` - Assigns image to stack
- `getStackImages()` - Gets images in a stack
- `getUnsortedImages()` - Gets images without stack
- `deleteStack()` - Deletes stack and all images
- `deleteImage()` - Deletes single image

**All functions:**
- Check authentication via `getCurrentUser()`
- Verify ownership (RLS policies enforce this)
- Handle errors gracefully
- Use Supabase client for database operations

#### 5. **Image Analysis Services**

**Google Vision API** (`src/lib/googleVision.ts`)

**Process:**
1. Convert image file to base64
2. Send POST request to Google Vision API
3. Request features:
   - `LABEL_DETECTION` - Identify objects/scenes (max 20)
   - `OBJECT_LOCALIZATION` - Detect specific objects (max 20)
   - `IMAGE_PROPERTIES` - Color analysis
4. Extract labels and objects with confidence scores
5. Create normalized feature vector from labels/objects
6. Return features for similarity comparison

**Similarity Calculation:**
- Uses cosine similarity between feature vectors
- Converts to percentage (0-100%)
- Groups images with similarity > threshold (default 50%)

**Alternative: Perceptual Hash** (`src/lib/imageSimilarity.ts`)
- Browser-based pHash algorithm (not currently used in main flow)
- Calculates 8x8 grayscale hash
- Uses Hamming distance for comparison
- Fallback option if Google Vision API unavailable

---

## Backend Architecture

### Services Running

1. **FastAPI Server** (`uvicorn app.main:app --reload`)
   - Port: `8000`
   - Auto-reload on code changes
   - CORS enabled for `localhost:3000`

### Current Implementation

**Status:** Minimal - Currently only has basic auth endpoints (not actively used by frontend)

#### 1. **Main Application** (`backend/app/main.py`)

**Setup:**
- FastAPI app instance
- CORS middleware (allows frontend to call backend)
- Database initialization on startup
- Health check endpoint (`/health`)

**Endpoints:**
- `GET /health` - Health check
- `POST /auth/login` - Login (returns dev token)
- `POST /auth/signup` - Signup (creates user, returns dev token)

**Note:** Frontend currently uses Supabase Auth directly, so these endpoints are not actively used.

#### 2. **Database Models** (`backend/app/models.py`)

**Tables:**
- `users` - User accounts (id, email, password_hash, name, created_at)
- `product_stacks` - Image groups (id, title, description, price, owner_id, created_at)
- `product_images` - Image records (id, url, stack_id)
- `tasks` - Background tasks (id, type, status, result, created_at)

**Note:** These models exist but the frontend uses Supabase's database directly, not this backend database.

#### 3. **Authentication** (`backend/app/auth.py`)

**Endpoints:**
- `POST /auth/login` - Validates credentials, returns JWT token
- `POST /auth/signup` - Creates user with bcrypt hashed password

**Note:** Currently returns placeholder "dev-token". Not integrated with frontend.

#### 4. **Database Connection** (`backend/app/db.py`)

**Setup:**
- SQLAlchemy engine from `DATABASE_URL` environment variable
- Session factory for database operations
- Base class for ORM models

**Database URL Format:**
```
postgresql+psycopg2://user:password@host:port/database
```

---

## Data Flow

### 1. User Registration/Login

```
User fills form
  ↓
Frontend calls supabase.auth.signUp() or signInWithPassword()
  ↓
Supabase Auth Service:
  - Validates credentials
  - Hashes password (bcrypt)
  - Creates auth.users record
  - Returns JWT token
  ↓
Frontend stores session
  ↓
Middleware checks session on protected routes
```

### 2. Image Upload Flow

```
User drops images
  ↓
Frontend: Convert to base64
  ↓
Frontend: Call Google Vision API for each image
  ↓
Google Vision API returns:
  - Labels (e.g., "Furniture", "Chair", "Wood")
  - Objects (e.g., "Chair", "Table")
  - Feature vector
  ↓
Frontend: Upload file to Supabase Storage
  Storage path: {userId}/{timestamp}_{uuid}.{ext}
  Bucket: "product-images"
  ↓
Frontend: Create product_image record in Supabase
  - storage_path: path in storage
  - stack_id: NULL (unsorted)
  - metadata: { features: [...], labels: [...] }
  ↓
Database: Insert into product_images table
  (RLS policy ensures user can only see their images)
```

### 3. Image Sorting/Grouping Flow

```
User clicks "Sort Images"
  ↓
Frontend: Fetch all unsorted images (stack_id IS NULL)
  ↓
Frontend: Extract features from metadata for each image
  ↓
Frontend: Calculate similarity matrix
  - Compare all image pairs using cosine similarity
  - Group images with similarity > 50%
  ↓
For each group:
  Frontend: Create product_stack record
    - title: auto-generated or user-provided
    - owner_id: current user ID
  ↓
  Frontend: Update all images in group
    - Set stack_id to new stack ID
  ↓
Database: Updates via Supabase client
  (RLS policies ensure user can only modify their data)
```

### 4. Stack Viewing Flow

```
User clicks on a stack
  ↓
Frontend: Navigate to /stack/[id]
  ↓
Frontend: Fetch stack details (getStack)
  - Verifies ownership via RLS
  ↓
Frontend: Fetch images in stack (getStackImages)
  ↓
Frontend: Generate signed URLs for each image
  supabase.storage.from("product-images").getPublicUrl(path)
  ↓
Frontend: Display images in gallery
```

---

## Database Schema (Supabase)

### Tables

#### `profiles`
- `id` (UUID, PK) - Matches auth.users.id
- `email` (text)
- `full_name` (text, nullable)
- `created_at` (timestamp)

#### `product_stacks`
- `id` (UUID, PK)
- `owner_id` (UUID, FK → profiles.id)
- `title` (text, nullable)
- `description` (text, nullable)
- `price` (numeric, nullable)
- `currency` (text, default: "AUD")
- `metadata` (jsonb, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### `product_images`
- `id` (UUID, PK)
- `stack_id` (UUID, FK → product_stacks.id, nullable)
- `storage_path` (text) - Path in Supabase Storage
- `filename` (text)
- `width` (integer, nullable)
- `height` (integer, nullable)
- `image_hash` (text, nullable) - Perceptual hash (if used)
- `processed` (boolean, default: false)
- `metadata` (jsonb) - Stores Google Vision features/labels
- `created_at` (timestamp)

### Row Level Security (RLS) Policies

**profiles:**
- Users can read their own profile
- Users can insert/update their own profile

**product_stacks:**
- Users can read their own stacks
- Users can insert their own stacks
- Users can update/delete their own stacks

**product_images:**
- Users can read images in their stacks
- Users can insert images (must belong to their stack or be unsorted)
- Users can update/delete their own images

---

## External Services

### 1. Supabase

**Services Used:**
- **Auth**: User authentication, session management
- **Database**: PostgreSQL database with RLS
- **Storage**: File storage for images (bucket: "product-images")
- **Realtime**: (Not currently used, but available)

**Configuration:**
- `NEXT_PUBLIC_SUPABASE_URL` - Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key

**Storage Buckets:**
- `product-images` - Stores uploaded product images

### 2. Google Cloud Vision API

**Purpose:** Image analysis for similarity detection

**Features Used:**
- Label Detection - Identifies objects/scenes in images
- Object Localization - Detects specific objects
- Image Properties - Color analysis

**Configuration:**
- `NEXT_PUBLIC_GOOGLE_VISION_API_KEY` - API key

**API Endpoint:**
```
POST https://vision.googleapis.com/v1/images:annotate?key={API_KEY}
```

**Rate Limits:**
- Free tier: 1,000 requests/month
- Paid: Higher limits

**Cost:**
- First 1,000 requests/month: Free
- Additional: ~$1.50 per 1,000 requests

### 3. Docker Services (Optional)

**docker-compose.yml defines:**
- PostgreSQL (port 5433)
- MinIO (S3-compatible storage, ports 9000, 9001)
- Redis (port 6379)
- Backend service (port 8000)
- Frontend service (port 3000)

**Note:** Currently, the app uses Supabase instead of these local services.

---

## Environment Variables

### Frontend (`.env.local` in `frontend/` directory)

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_GOOGLE_VISION_API_KEY=your-google-vision-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (`.env` in `backend/` directory)

```env
DATABASE_URL=postgresql+psycopg2://user:password@host:port/database
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Development Workflow

### Starting the Application

1. **Frontend:**
   ```bash
   cd frontend
   pnpm install  # First time only
   pnpm dev     # Starts on http://localhost:3000
   ```

2. **Backend (Optional - not required for current functionality):**
   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Docker Services (Optional):**
   ```bash
   docker-compose up
   ```

### Typical Development Session

1. **Start Frontend:**
   - `cd frontend && pnpm dev`
   - App runs on `http://localhost:3000`

2. **Development:**
   - Edit files in `frontend/src/`
   - Hot reload automatically updates browser
   - Check browser console for errors
   - Check terminal for build errors

3. **Testing:**
   - Test authentication flow
   - Upload images
   - Test image sorting
   - Verify stack creation/viewing

4. **Debugging:**
   - Browser DevTools for frontend issues
   - Network tab to see API calls
   - Supabase Dashboard for database inspection
   - Google Cloud Console for Vision API usage

---

## Key Design Decisions

1. **Supabase for Everything:**
   - Single service for auth, database, and storage
   - Reduces infrastructure complexity
   - Built-in RLS for security

2. **Client-Side Image Processing:**
   - Google Vision API called directly from browser
   - No backend processing required
   - Reduces server costs

3. **Feature-Based Similarity:**
   - Uses Google Vision labels/objects for grouping
   - More accurate than pixel-based comparison
   - Handles different angles, lighting, sizes

4. **RLS for Security:**
   - Database-level security policies
   - Users can only access their own data
   - No need for complex backend authorization

5. **Minimal Backend:**
   - Most operations happen client-side
   - Backend exists for future expansion
   - Can add background jobs, webhooks, etc.

---

## Common Issues & Solutions

### 1. Supabase Connection Errors

**Symptoms:** "Unable to connect to Supabase" error

**Solutions:**
- Check `.env.local` file exists in `frontend/` directory
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Restart dev server after changing env variables
- Check Supabase project is active (not paused)

### 2. Google Vision API Errors

**Symptoms:** "API method not enabled" or "quota exceeded"

**Solutions:**
- Enable Cloud Vision API in Google Cloud Console
- Check API key restrictions
- Verify billing is enabled (free tier available)
- Check quota limits in Google Cloud Console

### 3. RLS Policy Errors

**Symptoms:** "Access denied" or "Row not found" errors

**Solutions:**
- Ensure `ensureUserExists()` is called before creating stacks
- Check RLS policies in Supabase Dashboard
- Verify user is authenticated
- Check that `owner_id` matches authenticated user ID

### 4. Image Upload Failures

**Symptoms:** Images fail to upload or appear

**Solutions:**
- Check Supabase Storage bucket "product-images" exists
- Verify storage bucket policies allow uploads
- Check file size limits (Supabase default: 50MB)
- Verify storage path format is correct

---

## Future Enhancements

1. **Backend Integration:**
   - Move image processing to backend
   - Add background job processing
   - Implement webhooks for async operations

2. **Additional Features:**
   - Image editing capabilities
   - Export stacks as PDF/zip
   - Share stacks with other users
   - Advanced search/filtering

3. **Performance:**
   - Image optimization/compression
   - Lazy loading for large galleries
   - Caching strategies

4. **Analytics:**
   - Track image upload patterns
   - Monitor API usage
   - User behavior analytics

---

## File Structure

```
Snaplyst/
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js app router pages
│   │   │   ├── page.tsx      # Home/login page
│   │   │   ├── profile/      # Profile page
│   │   │   └── stack/[id]/   # Stack detail page
│   │   ├── lib/              # Utility libraries
│   │   │   ├── api.ts        # Supabase API wrapper
│   │   │   ├── supabaseClient.ts
│   │   │   ├── googleVision.ts
│   │   │   └── imageSimilarity.ts
│   │   ├── utils/            # Helper functions
│   │   │   └── auth.ts
│   │   └── middleware.ts     # Next.js middleware
│   ├── .env.local            # Environment variables
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app
│   │   ├── auth.py            # Auth endpoints
│   │   ├── models.py          # Database models
│   │   └── db.py              # Database connection
│   └── requirements.txt
├── docker-compose.yml         # Docker services
└── SUPABASE_SETUP.md          # Supabase setup guide
```

---

## Summary

**Current State:**
- Frontend is fully functional and handles all core features
- Backend exists but is minimal (not actively used)
- All data operations go through Supabase
- Image analysis happens client-side via Google Vision API

**Data Flow:**
- User → Frontend → Supabase (Auth/DB/Storage) + Google Vision API

**Key Services:**
- **Frontend**: Next.js dev server (port 3000)
- **Backend**: FastAPI (port 8000, optional)
- **Supabase**: Auth, Database, Storage (cloud)
- **Google Vision API**: Image analysis (cloud)

**Development Focus:**
- Most development happens in `frontend/src/`
- Backend can be expanded for future features
- Supabase Dashboard used for database/storage management

