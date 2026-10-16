# Supabase Setup Guide

This guide will help you set up Supabase for the Snaplyst application.

## Prerequisites

1. A Supabase account (sign up at [https://supabase.com](https://supabase.com) if you don't have one)

## Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in your project details:
   - **Name**: Choose a name for your project (e.g., "snaplyst")
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the region closest to you
4. Click "Create new project" and wait for it to be set up (this takes a few minutes)

## Step 2: Get Your Supabase Credentials

Once your project is created:

1. Go to your project dashboard
2. Click on the **Settings** icon (gear icon) in the left sidebar
3. Click on **API** in the settings menu
4. You'll find two important values:
   - **Project URL**: This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key: This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Step 3: Configure Environment Variables

### For Local Development

1. Create a `.env.local` file in the `frontend` directory (if it doesn't exist)
2. Add the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace:
- `https://your-project-id.supabase.co` with your actual Project URL from Step 2
- `your-anon-key-here` with your actual anon public key from Step 2

### Example `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTIzNDU2NywiZXhwIjoxOTYwODEwNTY3fQ.example
```

## Step 4: Restart Your Development Server

After creating or updating your `.env.local` file:

1. Stop your current development server (if running) by pressing `Ctrl+C` in the terminal
2. Restart it with:
   ```bash
   cd frontend
   pnpm dev
   ```

## Step 5: Verify the Setup

1. Open your browser and navigate to `http://localhost:3000`
2. Check the browser console (F12) - you should NOT see any Supabase configuration errors
3. Try to sign up or log in - it should now connect to your Supabase project

## Troubleshooting

### Error: "Unable to connect to Supabase"

- **Check your URL**: Make sure `NEXT_PUBLIC_SUPABASE_URL` starts with `https://` and ends with `.supabase.co`
- **Check your key**: Make sure `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the `anon public` key, not the `service_role` key
- **Restart the server**: After changing `.env.local`, you must restart the Next.js dev server
- **File location**: Make sure `.env.local` is in the `frontend` directory, not the root directory

### Error: "Missing Supabase environment variables"

- Make sure your `.env.local` file exists in the `frontend` directory
- Check that the variable names are exactly:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Make sure there are no spaces around the `=` sign
- Restart your development server after creating/editing the file

### Still having issues?

1. Verify your credentials are correct in the Supabase dashboard
2. Check that your Supabase project is active (not paused)
3. Make sure you're using the correct project (if you have multiple projects)

## Security Notes

- **Never commit `.env.local` to git** - it's already in `.gitignore`
- The `anon` key is safe to use in client-side code (it's public)
- Never share your `service_role` key - it has admin access

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)

## Guest access ("Continue as guest")

Recruiters can try the app without an account. A guest is an anonymous Supabase user with **5 credits**. Photo analysis (Google Vision) and background removal each spend one credit. The balance is stored in Postgres and decremented by the backend, not by the browser. When the balance hits zero, the app asks them to sign up. Signing up from the guest session keeps the same user id, so the photos stay with the account.

### 1. Enable anonymous sign-ins

In the Supabase dashboard:

1. Open **Authentication → Sign In / Providers** (or **Authentication → Providers**).
2. Enable **Anonymous sign-ins**.
3. Save.

Without this, "Continue as guest" cannot create a session.

### 2. Run the migration

In **SQL Editor**, run the file:

`supabase/migrations/20261016120000_guest_credits.sql`

That creates `guest_credits`, the per-network quota (3 new guest balances per hashed IP per 24 hours), and the service-role-only functions `grant_guest_credits`, `consume_guest_credit`, and `refund_guest_credit`. It also adds a nullable `product_images.owner_id`. Run it **before** deploying the frontend.

The functions are revoked from `anon` and `authenticated`. Guests can read only their own balance. They cannot insert or edit credits.

### 3. Keep guest files in the guest's folder

Storage policies are OR'd together, so this migration does not delete an existing wide policy. In **Storage → product-images**, remove any policy that lets every signed-in user read or write the whole bucket. Keep one equivalent to:

```sql
bucket_id = 'product-images'
and (storage.foldername(name))[1] = auth.uid()::text
```

Background removal also refuses a `storage_path` whose first folder is not the caller's user id, because that upload uses the service role and bypasses storage RLS.

### 4. Environment variables Yuvraj needs to set

Frontend (Vercel), already used by the app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` — the Railway background-service URL
- `NEXT_PUBLIC_GOOGLE_VISION_API_KEY` — still used when a signed-in account analyzes photos in the browser

Backend (Railway):

- `SUPABASE_URL` — same project URL
- `SUPABASE_SERVICE_ROLE_KEY` — server only. Never `NEXT_PUBLIC_`.
- `GOOGLE_VISION_API_KEY` — server-side Vision key for **guest** photo analysis. The credit is spent before this call.
- `GUEST_IP_SALT` — optional random string used to hash IP addresses for the 3-accounts-per-24h cap. If unset, the service role key is the salt.
- `ALLOWED_ORIGINS` — include `https://snaplyst-ai.vercel.app`

No new public frontend variable is required. Do not add the service role key to Vercel.

