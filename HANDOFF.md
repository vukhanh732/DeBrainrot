# DeBrainRot — Session Handoff

**Date:** 2026-06-25  
**Branch:** `main` (all work committed directly to main)  
**Last commit:** `3d29343`

---

## What Was Completed This Session

### Phase 1 (previous session — fully done)
- Next.js 16 scaffold, Supabase auth (Google OAuth + email/password + guest), Arithmetic Sprint game, leaderboard, server-side anti-cheat, SHA-256 config-hash, percentile scoring
- 20 unit tests passing
- Pushed to: https://github.com/vukhanh732/DeBrainrot

### Phase 2 — Tasks completed (3 of 8)

**Task 1 ✅ — Shared Infrastructure**
- `types/index.ts`: `GameMode` union expanded to all 4 modes; `GameResult.duration` widened to `number`
- `lib/config-hash.ts`: added `hashConfig(obj)` generic hash utility
- `lib/anti-cheat.ts`: new modes added (`bubble-burst`, `falling-equations`, `number-hunt` with `duration:0` key)
- `app/api/scores/route.ts`: `ALLOWED_MODES` expanded to all 4 modes; anti-cheat call generalized
- `app/page.tsx`: all 4 game cards now `available: true`

**Task 2 ✅ — Bubble Burst Engine (TDD)**
- `games/bubble-burst/engine.ts`: `generateWave`, `scoreBubbleTap`, `WAVE_COUNT=10`, `WAVE_DURATION=20000`, `BUBBLE_BURST_CONFIG_HASH`
- `games/bubble-burst/engine.test.ts`: 16 tests passing (includes wave 3 correct-count fix)
- Bug found + fixed: `getCorrectCount` formula was off-by-one at wave 3

**Task 3 ✅ — Bubble Burst UI**
- `games/bubble-burst/GameScreen.tsx`: bubbles float up, correct tap scores points, wrong tap flashes red, 10 waves
- `games/bubble-burst/ResultsScreen.tsx`: saves score, confetti on PB, guest prompt
- `app/play/bubble-burst/page.tsx`: playing → results state machine

**Current test count:** 36 tests passing across 4 files

---

## What Is Left (Phase 2, Tasks 4–8)

### Task 4 — Falling Equations Engine (TDD)
Create:
- `games/falling-equations/engine.ts`
- `games/falling-equations/engine.test.ts`

Exports needed:
- `FallingBlock` interface: `{ id, problem, spawnTime, fallDuration }`
- `getLevel(correctCount: number): number` — level 1 at 0 correct, +1 every 5 correct
- `getFallDuration(level: number): number` — 20000ms L1, 16000 L2, 13000 L3, 10000 L4, 8000 L5+
- `getEquationCount(level: number): number` — 1 for L1–4, 2 for L5+
- `generateBlock(level: number): FallingBlock`
- `scoreBlockAnswer(block, answerTime): number` — 1–100 based on remaining fall fraction
- `FALLING_EQUATIONS_CONFIG_HASH: Promise<string>` — `hashConfig({ mode: 'falling-equations', version: 1 })`

Anti-cheat max: `{ 0: 12000 }` (already in anti-cheat.ts from Task 1)

### Task 5 — Falling Equations UI
Create:
- `games/falling-equations/GameScreen.tsx`
- `games/falling-equations/ResultsScreen.tsx`
- `app/play/falling-equations/page.tsx`

Mechanics: Blocks fall from top (framer-motion `animate={{ y: '82%' }}`), input + Enter at bottom, correct = block gone, wrong = input clears, block hits floor (timeout = fallDuration) = lose 1 life. Start with 3 lives. Game ends at 0 lives. `mode='falling-equations'`, `duration: 0` in metadata.

### Task 6 — Number Hunt Engine (TDD)
Create:
- `games/number-hunt/engine.ts`
- `games/number-hunt/engine.test.ts`

Exports needed:
- `Rule` union type: `multiple | greaterThan | lessThan | even | odd | square | compound`
- `HuntGrid` interface: `{ numbers: number[], rule: Rule, correctIndices: Set<number>, roundDuration: number }`
- `generateGrid(round: number): HuntGrid` — 25 numbers, 2–20 correct, roundDuration 15000ms–8000ms
- `describeRule(rule: Rule): string` — human-readable
- `checkAnswer(index: number, grid: HuntGrid): boolean`
- `ROUND_COUNT = 10`
- `NUMBER_HUNT_CONFIG_HASH: Promise<string>` — `hashConfig({ mode: 'number-hunt', version: 1 })`

### Task 7 — Number Hunt UI
Create:
- `games/number-hunt/GameScreen.tsx`
- `games/number-hunt/ResultsScreen.tsx`
- `app/play/number-hunt/page.tsx`

Mechanics: 5×5 grid of numbers, rule shown at top, tap all correct ones before per-round timer (15s→8s), wrong tap flashes red −2pts, completing all correct ends round early with time bonus, 10 rounds then results. `mode='number-hunt'`, `duration: 0`.

### Task 8 — Combined Leaderboard

**MANUAL STEP REQUIRED FIRST:** Run this SQL in Supabase SQL editor before implementing Task 8:

```sql
create or replace function get_combined_scores(p_limit int default 50)
returns table (
  user_id uuid,
  username text,
  total_score bigint,
  arithmetic_best int,
  bubble_burst_best int,
  falling_equations_best int,
  number_hunt_best int
) language sql security definer as $$
  select
    p.id as user_id,
    p.username,
    coalesce(a.best, 0) + coalesce(b.best, 0) + coalesce(f.best, 0) + coalesce(n.best, 0) as total_score,
    coalesce(a.best, 0) as arithmetic_best,
    coalesce(b.best, 0) as bubble_burst_best,
    coalesce(f.best, 0) as falling_equations_best,
    coalesce(n.best, 0) as number_hunt_best
  from public.profiles p
  left join (select user_id, max(score) as best from public.scores where mode = 'arithmetic' group by user_id) a on a.user_id = p.id
  left join (select user_id, max(score) as best from public.scores where mode = 'bubble-burst' group by user_id) b on b.user_id = p.id
  left join (select user_id, max(score) as best from public.scores where mode = 'falling-equations' group by user_id) f on f.user_id = p.id
  left join (select user_id, max(score) as best from public.scores where mode = 'number-hunt' group by user_id) n on n.user_id = p.id
  where (coalesce(a.best, 0) + coalesce(b.best, 0) + coalesce(f.best, 0) + coalesce(n.best, 0)) > 0
  order by total_score desc
  limit p_limit;
$$;
```

Modify:
- `components/Leaderboard.tsx`: handle `mode='combined'` via `supabase.rpc('get_combined_scores')`; hide today/alltime toggle for combined mode
- `app/leaderboard/page.tsx`: add 5 mode tabs (Arithmetic Sprint | Bubble Burst | Falling Equations | Number Hunt | All Modes); convert to `'use client'` component

---

## How to Resume

Open a new Claude Code session in `/home/vukhanh732/DeBrainrot` and say:

```
Continue Phase 2 from Task 4. The handoff file is at HANDOFF.md. 
Progress ledger is at .superpowers/sdd/progress.md.
Plan is at docs/superpowers/plans/2026-06-24-debrainrot-phase2.md.
Use subagent-driven-development to execute Tasks 4–8.
```

The subagent skill will pick up from Task 4. The ledger at `.superpowers/sdd/progress.md` tracks completed tasks so nothing gets re-done.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `docs/superpowers/plans/2026-06-24-debrainrot-phase2.md` | Full implementation plan (Tasks 1–8 with complete code) |
| `docs/superpowers/specs/2026-06-24-debrainrot-phase2-design.md` | Design spec |
| `.superpowers/sdd/progress.md` | SDD progress ledger |
| `lib/config-hash.ts` | `hashConfig()` generic hash utility |
| `lib/anti-cheat.ts` | Max scores for all 4 modes |
| `games/arithmetic/engine.ts` | `generateProblem()` — reused by new modes |

## Manual Steps Still Needed (Phase 1)
If not done yet from Phase 1:
1. Run Phase 1 SQL schema from `docs/superpowers/specs/2026-06-24-debrainrot-phase1-design.md` Section 3 in Supabase SQL editor
2. Enable Google OAuth: Supabase → Authentication → Providers → Google
3. Add `http://localhost:3000/api/auth/callback` to Supabase redirect URLs
