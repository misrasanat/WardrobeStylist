# Wardrobe Stylist

Upload photos of your clothes, get them auto-tagged (category, color, pattern, season,
style), and ask for outfit suggestions. Runs entirely on free tiers:

- **Frontend**: React + Vite
- **Database + storage + auth**: [Supabase](https://supabase.com) (free tier)
- **Image tagging + outfit suggestions**: [Google Gemini](https://aistudio.google.com) (free tier)
- **Hosting**: [Vercel](https://vercel.com) (free tier)

## One-time setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the contents of [`supabase/schema.sql`](supabase/schema.sql). This
   creates the `clothing_items` / `outfits` tables, row-level security policies, and the
   `clothing-images` storage bucket + its access policy.
3. In **Storage**, confirm the `clothing-images` bucket exists and is **private**.
4. In **Project Settings → API**, copy the **Project URL** and **anon public key**.

### 2. Gemini API key

1. Go to [aistudio.google.com](https://aistudio.google.com) → **Get API key** → create one.

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in the three values:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
```

## Run locally

```
npm install
npm run dev
```

The files in `/api` are plain Vercel serverless functions, but a small Vite plugin
(`vite.config.js`) runs them directly inside the dev server, so `npm run dev` alone gives you
a fully working local app — no separate CLI or login needed. The same unmodified files run as
real serverless functions once deployed to Vercel.

## Deploy (free)

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. In the Vercel project's **Settings → Environment Variables**, add the same three variables
   from `.env.local`.
4. Deploy. Vercel auto-builds the Vite app and deploys `/api` as serverless functions.

## Notes

- Photos are downscaled/compressed client-side before upload to stay well within Supabase's
  free storage tier.
- The Gemini API key never reaches the browser — all calls go through the `/api/analyze` and
  `/api/suggest` serverless functions.
- Everything is scoped per-user via Supabase auth + row-level security, so this is safe to
  deploy publicly even with the free "simple login" setup.
