# Snaplyst

Snaplyst groups product photos and can remove backgrounds. The live app is [https://snaplyst-ai.vercel.app](https://snaplyst-ai.vercel.app).

## Guest access

The sign-in screen has **Continue as guest**. A guest gets **5 credits**. Each photo analysis and each background removal spends one. The remaining balance is shown in the app. At zero, Snaplyst asks the visitor to create an account. Signing up from that session keeps the photos they already uploaded.

Credits are enforced in Postgres and on the FastAPI service, not only in the browser. Guests are anonymous Supabase users, so existing row-level security keeps their stacks and images separate from other accounts. A network can start at most 3 guest balances per 24 hours.

Before this works in production:

1. Enable **Anonymous sign-ins** in Supabase.
2. Run `supabase/migrations/20261016120000_guest_credits.sql`.
3. On the Railway backend, set `GOOGLE_VISION_API_KEY` and (recommended) `GUEST_IP_SALT`, along with the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

The full checklist, including the storage-policy note, is in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Tests

```bash
cd frontend && pnpm install && pnpm lint && pnpm test
cd backend && pip install -r requirements-dev.txt && ruff check . && pytest
```

Background-removal tests mock rembg, so they do not download ONNX models.
