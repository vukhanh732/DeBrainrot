# DeBrainRot — Phase 2 Design Spec

**Date:** 2026-06-24  
**Scope:** Three new game modes — Bubble Burst, Falling Equations, Number Hunt — plus a combined leaderboard

---

## 1. Overview

Phase 2 adds three new game modes to the existing DeBrainRot platform. All modes follow the same pattern as Phase 1's Arithmetic Sprint:

- Self-contained in `/games/<mode>/` (engine + game screen + results screen)
- No config screen — difficulty ramps automatically
- Scores saved to the existing `scores` table via `/api/scores`
- Per-mode leaderboard using the existing `Leaderboard` component
- A new "All Modes" combined leaderboard tab

Architecture: pure React + CSS animations (no canvas). Consistent with Phase 1 patterns.

---

## 2. Folder Structure (additions)

```
/games
  /bubble-burst/
    /engine.ts           — wave generation, bubble lifecycle, scoring
    /engine.test.ts      — unit tests
    /GameScreen.tsx      — active gameplay (bubbles, problem, timer)
    /ResultsScreen.tsx   — score, wave reached, personal best, confetti
  /falling-equations/
    /engine.ts           — equation generation, fall speed by level, scoring
    /engine.test.ts
    /GameScreen.tsx      — falling block, input, lives display
    /ResultsScreen.tsx
  /number-hunt/
    /engine.ts           — grid generation, rule generation, scoring
    /engine.test.ts
    /GameScreen.tsx      — grid, rule display, timer
    /ResultsScreen.tsx

/app/play
  /bubble-burst/page.tsx
  /falling-equations/page.tsx
  /number-hunt/page.tsx
```

---

## 3. Game Mode: Bubble Burst

### Mechanics

- **Structure:** 10 waves. Each wave lasts 20 seconds.
- **Problem display:** One arithmetic problem shown prominently at the top (e.g., "7 × 8 = ?")
- **Bubbles:** Float upward from the bottom. Each bubble contains a number. 1+ correct answers, rest are distractors.
- **Tap correct bubble:** Bubble bursts with animation; points awarded based on speed (see scoring).
- **Tap wrong bubble:** Bubble flashes red, pops — no life lost, game continues. (Visual feedback only — no audio system in Phase 2.)
- **Wave end:** After 20s the wave ends regardless of remaining bubbles. Next wave starts immediately.
- **Game end:** After wave 10, results screen is shown.

### Difficulty Ramp (per wave)

| Wave | Bubble count | Float duration | Number range |
|------|-------------|----------------|--------------|
| 1    | 4           | 8s             | 1–20         |
| 2    | 6           | 7s             | 1–25         |
| 3    | 7           | 6s             | 1–30         |
| ...  | +1–2/wave   | –1s/wave (min 4s) | +5/wave  |
| 10   | 12          | 4s             | 1–60         |

Multiple correct-answer bubbles appear from wave 3 onward (1 extra correct answer added every 3 waves).

### Scoring

Points per correct bubble = `Math.round(10 * (remainingLifeFraction))` where `remainingLifeFraction` = time remaining on that bubble / initial float duration. Range: 1–10 pts per bubble.

Total score = sum of all bubble points across all 10 waves.

### Problem Generation

Reuses arithmetic engine (`/games/arithmetic/engine.ts`) with `operation` randomly selected from `[add, subtract, multiply]` (no division for speed). Range scales with wave difficulty.

### Engine Interface (`/games/bubble-burst/engine.ts`)

```ts
interface Bubble {
  id: string
  value: number
  isCorrect: boolean
  spawnTime: number     // timestamp when spawned
  floatDuration: number // ms until it exits screen
  x: number            // horizontal position 0–100 (%)
}

interface Wave {
  waveNumber: number        // 1–10
  problem: Problem
  bubbles: Bubble[]
  waveDuration: number      // ms (20000)
}

function generateWave(waveNumber: number): Wave
function scoreBubbleTap(bubble: Bubble, tapTime: number): number
```

### Anti-Cheat Max Score

Max 10 pts × 12 bubbles × 10 waves = **1200 pts** (used in anti-cheat).

### Config Hash

`{ mode: 'bubble-burst', version: 1 }` — no user config, so hash is constant.

---

## 4. Game Mode: Falling Equations

### Mechanics

- **Lives:** Player starts with 3 lives.
- **Equations fall:** One equation block falls from the top at a time (2 simultaneous from level 5 onward).
- **Answer input:** Single text input at the bottom, always focused. Player types answer + Enter.
- **Correct answer:** Block disappears, new one spawns, score increases.
- **Wrong answer:** Input clears, block keeps falling (player can retry).
- **Block hits floor:** Lose 1 life, block removed, new one spawns.
- **Game end:** When all 3 lives are lost.

### Difficulty Ramp

Level increases every 5 correct answers:

| Level | Fall speed | Equations at once | Number range |
|-------|-----------|-------------------|--------------|
| 1     | 20s fall  | 1                 | 1–10         |
| 2     | 16s fall  | 1                 | 1–15         |
| 3     | 13s fall  | 1                 | 1–20         |
| 4     | 10s fall  | 1                 | 1–25         |
| 5+    | 8s fall   | 2                 | 1–30+        |

### Scoring

Points per correct answer = `Math.round(100 * (remainingFraction))` where `remainingFraction` = (fallDuration - timeElapsedSinceSpawn) / fallDuration. Range: 1–100 pts.

Total score = sum of points per correct answer.

### Engine Interface (`/games/falling-equations/engine.ts`)

```ts
interface FallingBlock {
  id: string
  problem: Problem
  spawnTime: number
  fallDuration: number  // ms for full fall
}

function generateBlock(level: number): FallingBlock
function scoreBlockAnswer(block: FallingBlock, answerTime: number): number
function getLevel(correctCount: number): number
```

### Anti-Cheat Max Score

Max 100 pts × ~120 correct answers (assuming ~2s per answer, 4 minutes of play) = **12000 pts**.

### Config Hash

`{ mode: 'falling-equations', version: 1 }`

---

## 5. Game Mode: Number Hunt

### Mechanics

- **Structure:** 10 rounds. Each round has its own timer.
- **Grid:** 5×5 grid of integers (25 numbers).
- **Rule:** A rule is displayed at the top (e.g., "Find all multiples of 7", "Find all numbers greater than 20", "Find all even numbers").
- **Tap correct:** Number highlights green, stays selected.
- **Tap wrong:** Number flashes red, deducts 2 pts.
- **Round completion:** When all correct numbers are tapped, round ends early with time bonus.
- **Timer expires:** Round ends, unselected correct answers briefly highlight red, next round starts.
- **Game end:** After round 10.

### Rule Types (rotating)

1. Multiples of N (N = 2, 3, 4, 5, 6, 7, 8, 9)
2. Numbers greater than X
3. Numbers less than X
4. Even / Odd numbers
5. Squares (1, 4, 9, 16, 25...)
6. Numbers divisible by both N and M

Rules scale in complexity with round number (simple rules early, compound rules later).

### Difficulty Ramp (per round)

| Round | Timer | Number range | Rule complexity |
|-------|-------|--------------|-----------------|
| 1–2   | 15s   | 1–30         | even/odd, mult of 2–3 |
| 3–4   | 13s   | 1–50         | mult of 4–5, > X |
| 5–6   | 12s   | 1–80         | mult of 6–7, < X |
| 7–8   | 10s   | 1–100        | mult of 8–9, squares |
| 9–10  | 8s    | 1–150        | compound (mult of N and even) |

### Scoring

- Correct tap: +10 pts
- Wrong tap: -2 pts (floor at 0)
- Round completion bonus: `Math.round(remainingTime * 3)` pts
- Score cannot go below 0.

### Engine Interface (`/games/number-hunt/engine.ts`)

```ts
type Rule =
  | { type: 'multiple'; n: number }
  | { type: 'greaterThan'; value: number }
  | { type: 'lessThan'; value: number }
  | { type: 'even' }
  | { type: 'odd' }
  | { type: 'square' }
  | { type: 'compound'; rules: Rule[] }

interface HuntGrid {
  numbers: number[]      // 25 numbers
  rule: Rule
  correctIndices: Set<number>
  roundDuration: number  // ms
}

function generateGrid(round: number): HuntGrid
function describeRule(rule: Rule): string   // human-readable rule text
function checkAnswer(index: number, grid: HuntGrid): boolean
```

### Anti-Cheat Max Score

Max ~25 pts/round (10 correct × 3pts bonus + 10 correct × 10pts) × 10 rounds ≈ **1300 pts** (generous cap).  
More precisely: 10 correct × 10pts + 15s × 3pts = 145pts per round × 10 = 1450pts max.

### Config Hash

`{ mode: 'number-hunt', version: 1 }`

---

## 6. Combined Leaderboard

### DB Function (run in Supabase SQL editor)

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

### UI Changes

- `Leaderboard` component gets a new `mode` value of `'combined'`
- When `mode === 'combined'`, call `supabase.rpc('get_combined_scores')` instead of the scores table query
- `/leaderboard/page.tsx` adds a "All Modes" tab alongside the mode tabs
- Combined leaderboard shows: rank, username, total score, and breakdown columns (optional, desktop only)

---

## 7. Shared Infrastructure Changes

### `types/index.ts`

```ts
export type GameMode = 'arithmetic' | 'bubble-burst' | 'falling-equations' | 'number-hunt'
```

`GameResult.duration` changes from `30 | 60 | 120` to `number` (new modes use `0` for duration since they are not timed-duration games — anti-cheat checks against `MAX_SCORES[mode][0]`).

### `/app/api/scores/route.ts`

```ts
const ALLOWED_MODES = ['arithmetic', 'bubble-burst', 'falling-equations', 'number-hunt'] as const
```

### `/lib/anti-cheat.ts`

Add max scores for new modes:

```ts
const MAX_SCORES: Record<string, Record<number, number>> = {
  arithmetic: { 30: 90, 60: 180, 120: 360 },
  'bubble-burst': { 0: 1200 },      // duration=0 means no duration config
  'falling-equations': { 0: 12000 },
  'number-hunt': { 0: 1450 },
}
```

Anti-cheat signature needs to handle modes without fixed durations — use `duration=0` to mean "mode-level check".

### `/app/page.tsx`

Update `GAME_MODES` to set `available: true` for all 3 new modes, with correct `href` values.

---

## 8. Routing

```
/play/bubble-burst       → app/play/bubble-burst/page.tsx
/play/falling-equations  → app/play/falling-equations/page.tsx
/play/number-hunt        → app/play/number-hunt/page.tsx
```

Each page is a state machine identical in structure to `/app/play/arithmetic/page.tsx`:
- `type GamePhase = 'playing' | 'results'` (no config phase — game starts immediately)
- `GameScreen` unmounts fully on phase change to reset all state

---

## 9. Testing Requirements

Each engine must have unit tests before the game screen is built (TDD):

- **bubble-burst/engine**: `generateWave` produces correct bubble count, exactly N correct answers, `scoreBubbleTap` returns correct range
- **falling-equations/engine**: `getLevel` increments correctly, `generateBlock` uses level-appropriate range, `scoreBlockAnswer` scales correctly
- **number-hunt/engine**: `generateGrid` places expected number of correct answers, `describeRule` is human-readable, `checkAnswer` is accurate for all rule types

---

## 10. Manual Steps Before Testing

1. Run the combined leaderboard SQL function (Section 6) in the Supabase SQL editor
2. Confirm existing Supabase auth + scores table from Phase 1 are already set up

---

## 11. Phase 2 Test Checklist

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] All unit tests pass (engine tests for all 3 modes)
- [ ] Bubble Burst: bubbles appear, tapping correct scores points, wrong taps flash red
- [ ] Bubble Burst: difficulty visibly increases wave to wave
- [ ] Falling Equations: block falls, correct answer removes block, wrong answer clears input
- [ ] Falling Equations: losing 3 lives ends game
- [ ] Number Hunt: grid renders, correct taps highlight green, round advances
- [ ] Number Hunt: timer counts down, new grid on round end
- [ ] All 3 modes save scores to leaderboard when logged in
- [ ] Combined leaderboard shows sum of personal bests
- [ ] All 3 game cards on homepage are now clickable
- [ ] Mobile: tap targets ≥44px on all new screens
