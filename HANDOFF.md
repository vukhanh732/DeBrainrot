# DeBrainRot — Session Handoff

**Last updated:** 2026-06-27  
**Branch:** `main` — all work committed and pushed  
**Last commit:** `c841efe`  
**Tests:** 72 passing, 0 failing (6 test files)

---

## How to Run

```bash
npm run dev        # dev server → http://localhost:3000
npm test           # run unit tests
npm run build      # production build
npm run lint       # lint check
```

Requires `.env.local` in project root:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## What Is Complete (Phase 1 + Phase 2 — fully done)

### Phase 1
- Next.js 16 App Router scaffold, TypeScript strict, Tailwind CSS 4, shadcn/ui
- Supabase auth: Google OAuth + email/password + guest
- Arithmetic Sprint game (config → play → results)
- Leaderboard with today/all-time toggle
- Server-side anti-cheat (`lib/anti-cheat.ts`), SHA-256 config hash, percentile scoring
- `/api/scores` endpoint, Supabase `scores` + `profiles` tables

### Phase 2
- **Bubble Burst** — tap correct-answer bubbles before they float away (10 waves, score on speed)
- **Falling Equations** — type answers before blocks hit the floor (3 lives, 2 lanes from level 5+)
- **Number Hunt** — tap all numbers matching a rule in a 5×5 grid (10 rounds, time bonus)
- **Combined Leaderboard** — 5 mode tabs (Arithmetic Sprint | Bubble Burst | Falling Equations | Number Hunt | All Modes)

---

## File Map

```
app/
  page.tsx                          — homepage with 4 game cards
  play/arithmetic/page.tsx          — Arithmetic Sprint page
  play/bubble-burst/page.tsx        — Bubble Burst page
  play/falling-equations/page.tsx   — Falling Equations page
  play/number-hunt/page.tsx         — Number Hunt page
  leaderboard/page.tsx              — Leaderboard page (5 mode tabs, 'use client')
  api/scores/route.ts               — POST /api/scores (anti-cheat, save, percentile)

games/
  arithmetic/engine.ts              — generateProblem() — reused by BB + FE
  arithmetic/GameScreen.tsx
  arithmetic/ConfigScreen.tsx
  arithmetic/ResultsScreen.tsx
  bubble-burst/engine.ts            — generateWave, scoreBubbleTap, WAVE_COUNT=10
  bubble-burst/engine.test.ts       — 16 tests
  bubble-burst/GameScreen.tsx
  bubble-burst/ResultsScreen.tsx
  falling-equations/engine.ts       — generateBlock, getLevel, getFallDuration, scoreBlockAnswer
  falling-equations/engine.test.ts  — 17 tests
  falling-equations/GameScreen.tsx
  falling-equations/ResultsScreen.tsx
  number-hunt/engine.ts             — generateGrid, describeRule, checkAnswer, ROUND_COUNT=10
  number-hunt/engine.test.ts        — 18 tests
  number-hunt/GameScreen.tsx
  number-hunt/ResultsScreen.tsx

components/
  Leaderboard.tsx                   — handles mode='combined' via Supabase RPC
  SiteHeader.tsx
  GameCard.tsx
  AuthProvider.tsx                  — useAuth() hook
  AuthModal.tsx

lib/
  anti-cheat.ts                     — isScorePlausible(mode, duration, score)
  config-hash.ts                    — hashConfig(obj), hashArithmeticConfig(config)
  supabase/client.ts                — browser Supabase client
  supabase/server.ts                — server Supabase client

supabase/migrations/
  get_combined_scores.sql           — SQL for All Modes leaderboard (must be run manually)

types/index.ts                      — GameMode, GameResult, Problem, ArithmeticConfig, etc.
```

---

## One Manual Step Still Required

The **All Modes** leaderboard tab requires a Postgres function in Supabase that hasn't been created yet. Until you do this, the tab shows "No scores yet" (graceful degradation — no crash).

**To enable it:** Go to your Supabase project → SQL Editor → run the contents of:
```
supabase/migrations/get_combined_scores.sql
```

---

## Key Technical Decisions

| Decision | Why |
|----------|-----|
| `proxy.ts` not `middleware.ts` | Next.js 16 breaking change — read `node_modules/next/dist/docs/` |
| `duration: 0` in metadata for new modes | Anti-cheat uses `MAX_SCORES[mode][0]` for modes with no time config |
| `hasSaved.current` checked BEFORE `!user` | Critical bug pattern — prevents dropping scores in guest→sign-up flow |
| `// eslint-disable-next-line react-hooks/set-state-in-effect` | React Compiler enforces no setState in effects without this |
| Two lanes in Falling Equations (`lane: 0/1`) | Level 5+ spawns 2 blocks — must be in separate halves of the arena |
| `blocks.find(b => parsed === b.problem.answer)` | Match any active block, not just `blocks[0]` |

---

## Anti-Cheat Max Scores

```typescript
// lib/anti-cheat.ts
const MAX_SCORES = {
  arithmetic:          { 30: 90, 60: 180, 120: 360 },
  'bubble-burst':      { 0: 1200 },
  'falling-equations': { 0: 12000 },
  'number-hunt':       { 0: 1450 },
}
```

---

## Known Minor Issues (not blocking, tracked)

- `scoreBlockAnswer` / `scoreBubbleTap` missing upper clamp (fraction > 1 if answerTime < spawnTime — unreachable in practice)
- Number Hunt timer interval re-creates on every tap (mild clock-cheese; use refs for deps to fix)
- `problemsPerMinute` in Number Hunt uses fixed estimated playtime instead of actual elapsed
- No `checkAnswer` test for compound rules in Number Hunt engine

---

## How to Continue in a New Chat

Open Claude Code in `/home/vukhanh732/DeBrainrot` and say what you want to work on. Good starting points:

- **Polish/UI improvements** — "I want to improve the UI for [game mode]"
- **Bug fixes** — reference the Known Minor Issues above
- **New features** — e.g., user profile page, XP/streak system, sound effects
- **Deploy** — "Help me deploy this to Vercel"
- **Supabase setup** — "Walk me through the Phase 1 SQL schema setup"

The codebase is fully documented in `docs/superpowers/`:
- `specs/2026-06-24-debrainrot-phase1-design.md` — Phase 1 design (includes SQL schema)
- `specs/2026-06-24-debrainrot-phase2-design.md` — Phase 2 design
- `plans/2026-06-24-debrainrot-phase2.md` — Phase 2 implementation plan (with full code)
