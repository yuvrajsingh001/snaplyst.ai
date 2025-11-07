# Temporarily Taking Down a Vercel Site

Vercel doesn't have a built-in "pause" button, but here are several ways to temporarily disable your site:

## Option 1: Password Protection (Easiest)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Deployment Protection**
3. Enable **Password Protection**
4. Set a password
5. All visitors will need the password to access the site

**To restore:** Disable password protection

## Option 2: Deploy a Maintenance Page

Create a simple maintenance page and deploy it:

1. Create `frontend/src/app/page.tsx` with maintenance message:
```tsx
export default function Maintenance() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Under Maintenance</h1>
        <p className="text-xl text-zinc-600">We'll be back soon!</p>
      </div>
    </div>
  );
}
```

2. Commit and push - this will replace your site with the maintenance page
3. **To restore:** Revert the commit or push your original code

## Option 3: Edge Middleware (Block All Traffic)

Create middleware to block all requests:

1. Create `frontend/src/middleware.ts`:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Block all requests - return maintenance page
  return new NextResponse(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Under Maintenance</title>
        <style>
          body {
            font-family: system-ui, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            text-align: center;
            padding: 2rem;
          }
          h1 { font-size: 2rem; margin-bottom: 1rem; }
          p { color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Under Maintenance</h1>
          <p>We'll be back soon!</p>
        </div>
      </body>
    </html>
    `,
    {
      status: 503,
      headers: {
        'Content-Type': 'text/html',
        'Retry-After': '3600', // Tell browsers to retry after 1 hour
      },
    }
  );
}

export const config = {
  matcher: '/(.*)',
};
```

2. Deploy this - all requests will be blocked
3. **To restore:** Delete or rename `middleware.ts`

## Option 4: Environment Variable Toggle

Use an environment variable to control maintenance mode:

1. Create `frontend/src/app/page.tsx`:
```tsx
export default function Home() {
  const isMaintenance = process.env.NEXT_PUBLIC_MAINTENANCE === 'true';
  
  if (isMaintenance) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Under Maintenance</h1>
          <p>We'll be back soon!</p>
        </div>
      </div>
    );
  }
  
  // Your normal app code
  return <div>Your app...</div>;
}
```

2. In Vercel dashboard:
   - Go to **Settings** → **Environment Variables**
   - Add: `NEXT_PUBLIC_MAINTENANCE` = `true`
   - Redeploy

3. **To restore:** Set `NEXT_PUBLIC_MAINTENANCE` = `false` or remove it

## Option 5: Remove Custom Domain (If Using One)

If you're using a custom domain:
1. Go to **Settings** → **Domains**
2. Remove the custom domain
3. Your site will only be accessible via `*.vercel.app` URL

**To restore:** Re-add the domain

## Option 6: Deploy to Preview Branch

1. Create a `maintenance` branch
2. Put maintenance page code there
3. Deploy that branch to production temporarily
4. **To restore:** Switch production back to `main` branch

## Recommended Approach

**For quick maintenance:** Use **Option 1 (Password Protection)** - it's instant and reversible.

**For longer maintenance:** Use **Option 3 (Edge Middleware)** - gives you a proper 503 status code and maintenance page.

**For scheduled maintenance:** Use **Option 4 (Environment Variable)** - easy to toggle on/off.

## Restoring Your Site

- **Password Protection:** Disable in Settings
- **Maintenance Page:** Revert commits or push original code
- **Middleware:** Delete `middleware.ts` file
- **Environment Variable:** Set to `false` or remove it
- **Domain:** Re-add in Settings
- **Branch:** Switch production deployment back to main branch


