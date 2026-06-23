# DeBrainRot — Phase 1 Design Spec

**Date:** 2026-06-24  
**Scope:** Foundation — scaffold, auth, Arithmetic Sprint game, leaderboard, anti-cheat

---

## 1. Project Context

Fresh Next.js project. No existing code. Deploying to Vercel free tier.

**Tech stack (locked):**
- Next.js 14+ (App Router) + TypeScript strict mode
- Tailwind CSS + shadcn/ui
- Supabase (auth + Postgres)
- lucide-react, framer-motion, canvas-confetti
- recharts (Phase 3+, install now, use later)

---

## 2. Folder Structure

```
/app
  /layout.tsx               — root layout, ThemeProvider, AuthProvider
  /page.tsx                 — game hub (card grid)
  /play/arithmetic/page.tsx — Arithmetic Sprint config + game + results
  /leaderboard/page.tsx     — leaderboard page
  /api
    /scores/route.ts        — POST score (server-side anti-cheat)
    /auth/callback/route.ts — OAuth redirect handler
/components
  /ui/                      — shadcn/ui primitives
  /GameCard.tsx             — hub card (playable + coming-soon states)
  /AuthModal.tsx            — login/signup modal
  /ThemeToggle.tsx          — light/dark toggle
  /Leaderboard.tsx          — leaderboard table
/games
  /arithmetic/
    /ConfigScreen.tsx       — operation + range + duration selector
    /GameScreen.tsx         — active gameplay
    /ResultsScreen.tsx      — score, accuracy, percentile, confetti
    /engine.ts              — problem generation, scoring logic
/lib
  /supabase/
    /client.ts              — browser client
    /server.ts              — server client (for API routes)
  /config-hash.ts           — deterministic SHA-256 hash of game config
  /percentile.ts            — percentile calculation from scores table
  /anti-cheat.ts            — max-score validation per mode
/types
  /index.ts                 — shared TypeScript types
```

---

## 3. Database Schema

Run this SQL in the Supabase SQL editor:

```sql
-- Profiles table
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  avatar_url text,
  subscription_status text default 'free',
  xp int default 0,
  streak int default 0,
  last_played date,
  created_at timestamptz default now()
);

-- Scores table
create table public.scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  mode text not null,
  config_hash text not null,
  score int not null,
  accuracy real not null,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Indexes for leaderboard queries
create index scores_mode_config_hash_idx on public.scores(mode, config_hash, score desc);
create index scores_user_id_idx on public.scores(user_id);

-- RLS
alter table public.profiles enable row level security;
alter table public.scores enable row level security;

-- Profiles: users read/update only their own
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Scores: users insert only their own; everyone reads
create policy "scores_insert_own" on public.scores
  for insert with check (auth.uid() = user_id);
create policy "scores_select_all" on public.scores
  for select using (true);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## 4. Authentication

- Supabase Auth with Google OAuth + email/password
- Guest play: no login required to play; score is not saved
- After a guest completes a game: show modal — "Log in to save your score and climb the leaderboard."
- OAuth callback: `/api/auth/callback` exchanges code for session
- Session managed via `@supabase/ssr` with cookie-based persistence

---

## 5. Game Hub (Home Page)

- Responsive card grid (2-col mobile, 3-col tablet, 4-col desktop)
- Phase 1: "Arithmetic Sprint" card is active
- Remaining cards ("Bubble Burst", "Falling Equations", "Number Hunt", etc.) shown as greyed-out "Coming Soon"
- DeBrainRot tone in empty/landing state: "Your brain is about to thank you. Pick a mode."
- Dark mode toggle in top-right header

---

## 6. Arithmetic Sprint Game

### Config Screen
- Toggle buttons for operations: `+`, `−`, `×`, `÷` (at least one required)
- Per-operation number range sliders (min/max for each operand)
- Duration selector: 30s / 60s / 120s (pill buttons)
- "Start" button disabled until ≥1 operation selected

### Gameplay Screen
- One problem at a time, centered, large text
- Numeric `<input>` — `type="number"`, `inputMode="numeric"` for mobile keyboard
- Auto-focus input on mount and after each answer
- Auto-advance on correct answer (no Enter required)
- Wrong answer: shake animation, clear input, keep same problem? No — spec says no penalty, skip to next.
  - **Decision:** wrong answer clears input, allows retry on same problem until correct or time expires. Timer keeps running. This matches Zetamac behavior.
- Countdown timer displayed prominently
- Correct answer counter

### Results Screen
- Score (correct count), accuracy (correct/total attempts), problems-per-minute
- Personal best for this exact config
- Percentile: "faster than X% of players for this config" — computed from `scores` table filtered by `mode='arithmetic'` and `config_hash`
- Canvas confetti if new personal best
- "Play Again" and "Change Config" buttons
- If guest: "Log in to save your score" prompt

### config_hash
Deterministic SHA-256 hash of a sorted JSON object:
```ts
{
  mode: 'arithmetic',
  operations: ['add', 'subtract', ...].sort(),
  ranges: { add: { min1, max1, min2, max2 }, ... },
  duration: 60
}
```
Used to group leaderboard entries by identical config.

### Problem Generation (`/games/arithmetic/engine.ts`)
- Generate two random integers within the configured range for the selected operation
- For division: generate `a` and `b` first, answer = `a * b`, problem = `(a*b) ÷ b` to guarantee integer answers
- Randomly cycle through enabled operations

---

## 7. Leaderboard

- Filter controls: mode (dropdown) + timeframe (Today / All-time)
- Config-aware: same config_hash filter as the game that was just played
- Show: rank, username (or "Anonymous"), score, created_at
- Percentile computed server-side from `scores` table
- Paginated: top 50 per page

---

## 8. Server-Side Anti-Cheat (`/api/scores/route.ts`)

Reject scores that exceed sane maximums:

| Mode | Duration | Max plausible score |
|------|----------|-------------------|
| arithmetic | 30s | 90 (3/sec) |
| arithmetic | 60s | 180 |
| arithmetic | 120s | 360 |

If `score > max`, return 400 with message "Score rejected: implausible result."

Also validate: `accuracy` is between 0–1, `mode` is a known string, `config_hash` is a valid hex string.

---

## 9. Unresolved Decisions (resolved here)

| Question | Decision |
|----------|----------|
| Wrong answer behavior | Clear input, allow retry on same problem (Zetamac-style) |
| config_hash format | SHA-256 hex of sorted JSON config object |
| Leaderboard scope | Filtered by exact config_hash — same config only |
| Division answer type | Always integer (generate `a*b ÷ b`) |
| Guest score flow | Play freely, prompt to login only on results screen |

---

## 10. Phase 1 Test Checklist

- [ ] `npm run build` passes with no errors
- [ ] `npm run lint` passes
- [ ] Can play Arithmetic Sprint as guest
- [ ] Can sign up with email/password
- [ ] Can sign up with Google
- [ ] Score saves after login
- [ ] Leaderboard displays correctly
- [ ] Personal best updates correctly
- [ ] Percentile calculation works (test with 5+ fake scores)
- [ ] Mobile layout: tap targets ≥44px, numeric keyboard appears on input
- [ ] Dark mode toggle works
- [ ] Implausible score (e.g. 500 in 30s) is rejected server-side
