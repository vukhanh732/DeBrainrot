# DeBrainRot

Free mental-math and brain-training web app. Cheeky tone, fast gameplay, fair leaderboards.

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd DeBrainRot
npm install
```

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

### 3. Supabase setup

1. Create a project at https://supabase.com
2. Run the SQL in `docs/superpowers/specs/2026-06-24-debrainrot-phase1-design.md` (section 3) in the SQL Editor
3. Enable Google OAuth: Authentication → Providers → Google → toggle on
4. Set the redirect URL to `https://<your-project>.supabase.co/auth/v1/callback`
5. Add `http://localhost:3000/api/auth/callback` to Authentication → URL Configuration → Redirect URLs

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

### 5. Deploy to Vercel

```bash
npx vercel
```

Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables in the Vercel dashboard.

## Tech Stack

- Next.js 16 (App Router) + TypeScript strict
- Tailwind CSS 4 + shadcn/ui
- Supabase (auth + Postgres)
- framer-motion, canvas-confetti, lucide-react

## Game Modes (Phase 1)

- **Arithmetic Sprint** — Zetamac-style: race against a timer, auto-advance on correct answer

## Development

```bash
npm run dev      # start dev server
npm run build    # production build
npm run lint     # ESLint
npm test         # Vitest unit tests
```
