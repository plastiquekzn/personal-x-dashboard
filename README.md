# Personal X Dashboard

Personal X/Twitter dashboard for saving your own posts without paying for the X API.

This project is designed for `self-hosting`. Each person should run their own copy with:

- their own `Supabase` project
- their own `Gemini API key`
- their own `Vercel` deployment or local dev setup

That keeps the app simple and much safer than sharing one central database between multiple people.

## What It Does

- Save posts from a `tweet URL` using live capture
- Save posts from a `screenshot`
- Extract:
  - project
  - date
  - time
  - replies
  - reposts
  - likes
  - views
  - AI summary
- Organize posts by project
- Sort posts by date or performance
- Manage project colors and logos

## Stack

- `Next.js` App Router
- `Supabase Postgres`
- `Supabase Storage`
- `Gemini 2.5 Flash`
- `Vercel`

## Self-Host Setup

Use the full guide here:

[docs/self-host-setup.md](C:\Users\Rafael\Documents\dashboard twitter\docs\self-host-setup.md)

That guide covers:

- GitHub
- Supabase setup
- SQL setup
- storage bucket setup
- Gemini key setup
- local run
- Vercel deploy

## Quick Start

1. Copy `.env.example` to `.env.local`
2. Create a `Supabase` project
3. Run [supabase/schema.sql](C:\Users\Rafael\Documents\dashboard twitter\supabase\schema.sql) in the Supabase SQL editor
4. Create a private bucket named `tweet-screenshots`
5. Create a `Gemini API key`
6. Install dependencies with `npm install`
7. Start the app with `npm run dev`

## Environment Variables

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_BUCKET`
- `GEMINI_API_KEY`

Optional:

- `GEMINI_MODEL`
  default: `gemini-2.5-flash`

## Security Notes

- Never commit `.env.local`
- Never share `SUPABASE_SERVICE_ROLE_KEY`
- Keep the Supabase storage bucket `private`
- This project currently assumes a `single-owner self-hosted deployment`

## Current User Flows

### Fast flow

From the main posts page:

1. Click `Add Post`
2. Pick a project
3. Paste a tweet URL
4. Review metrics and summary
5. Save

### Detailed flow

From `Add Post (Detailed)`:

1. Upload a screenshot
2. Pick a project
3. Run extraction
4. Review fields
5. Save

## Sharing This With Other People

If you want someone else to use it, do **not** give them your own keys or database.

Instead:

1. send them the GitHub repo
2. send them [docs/self-host-setup.md](C:\Users\Rafael\Documents\dashboard twitter\docs\self-host-setup.md)
3. let them create their own `Supabase`, `Gemini`, and `Vercel`

That is the intended setup for this version.
