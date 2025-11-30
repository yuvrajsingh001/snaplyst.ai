# Backend - Background Removal Service

**Note:** The backend is required for background removal functionality. It processes images server-side using Python ML libraries.

## Prerequisites
- Python 3.11+
- Virtual environment (recommended)

## Setup

1. Create and activate virtual environment:
   ```bash
   # Windows
   python -m venv .venv
   .venv\Scripts\activate
   
   # Linux/Mac
   python -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Server (Optional)

Start the development server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: http://localhost:8000

Health check endpoint: http://localhost:8000/health

API docs: http://localhost:8000/docs

## Deployment

The backend needs to be deployed separately from the frontend. See [DEPLOYMENT.md](../DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy Options:

**Railway (Recommended):**
1. Connect GitHub repository
2. Add Python service
3. Set root directory to `backend/`
4. Railway auto-detects and deploys

**Render:**
1. Create Web Service
2. Build: `cd backend && pip install -r requirements.txt`
3. Start: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Environment Variables:

Set `ALLOWED_ORIGINS` to include your frontend URL:
```env
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
```

### CORS Configuration:

The backend automatically reads `ALLOWED_ORIGINS` environment variable. Defaults to localhost for development.
