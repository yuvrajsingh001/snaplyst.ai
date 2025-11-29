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

