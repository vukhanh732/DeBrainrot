# DeBrainRot Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Bubble Burst, Falling Equations, and Number Hunt game modes plus a combined all-modes leaderboard.

**Architecture:** Self-contained game modules in `/games/<mode>/` (engine + GameScreen + ResultsScreen), matching Phase 1's Arithmetic Sprint pattern exactly. No config screens — difficulty ramps automatically. All three modes share the existing `/api/scores` endpoint, Supabase `scores` table, and `Leaderboard` component.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind CSS 4, shadcn/ui, framer-motion, canvas-confetti, Supabase (@supabase/ssr), Vitest.

## Global Constraints

- `npm run build` AND `npm run lint` must pass after every task before committing.
- `npm test` must pass after every task that touches test files.
- Never hardcode credentials. All Supabase keys come from `.env.local`.
- Read `node_modules/next/dist/docs/` for any unfamiliar Next.js APIs — this is Next.js 16, not 14. Proxy convention (not middleware).
- Minimum tap targets: 44px height on all interactive elements.
- React Compiler ESLint rules are enforced: no side effects during render, no ref reads/writes during render, all state-setting async calls in effects need `// eslint-disable-next-line react-hooks/set-state-in-effect`.
- TDD for all engine files: write failing test, verify fail, implement, verify pass, commit.

---

## File Map

**New files:**
- `games/bubble-burst/engine.ts` — wave generation, bubble scoring
- `games/bubble-burst/engine.test.ts` — unit tests
- `games/bubble-burst/GameScreen.tsx` — bubble gameplay UI
- `games/bubble-burst/ResultsScreen.tsx` — score display + save
- `app/play/bubble-burst/page.tsx` — state machine (playing → results)
- `games/falling-equations/engine.ts` — block generation, fall mechanics, scoring
- `games/falling-equations/engine.test.ts`
- `games/falling-equations/GameScreen.tsx` — falling block UI + input
- `games/falling-equations/ResultsScreen.tsx`
- `app/play/falling-equations/page.tsx`
- `games/number-hunt/engine.ts` — grid generation, rule generation, answer checking
- `games/number-hunt/engine.test.ts`
- `games/number-hunt/GameScreen.tsx` — grid UI + timer
- `games/number-hunt/ResultsScreen.tsx`
- `app/play/number-hunt/page.tsx`

**Modified files:**
- `types/index.ts` — expand `GameMode`, widen `GameResult.duration` to `number`
- `lib/config-hash.ts` — add generic `hashConfig` utility
- `lib/anti-cheat.ts` — add new mode max scores, loosen type to `Record<string, ...>`
- `app/api/scores/route.ts` — expand `ALLOWED_MODES`, generalize anti-cheat call
- `app/page.tsx` — mark 3 new modes `available: true`
- `components/Leaderboard.tsx` — handle `mode='combined'` via Supabase RPC
- `app/leaderboard/page.tsx` — add mode tabs (Arithmetic | Bubble Burst | Falling Equations | Number Hunt | All Modes)

---

## Task 1: Shared Infrastructure Updates

**Files:**
- Modify: `types/index.ts`
- Modify: `lib/config-hash.ts`
- Modify: `lib/anti-cheat.ts`
- Modify: `app/api/scores/route.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `GameMode` union with all 4 modes; `GameResult.duration: number`; `hashConfig()` async function; `isScorePlausible` accepting any string mode; ALLOWED_MODES with all 4 modes

- [ ] **Step 1: Update `types/index.ts`**

Replace the file content (keeping all existing exports, changing two things):

```typescript
export type GameMode = 'arithmetic' | 'bubble-burst' | 'falling-equations' | 'number-hunt'

export type Operation = 'add' | 'subtract' | 'multiply' | 'divide'

export interface OperationRange {
  min1: number
  max1: number
  min2: number
  max2: number
}

export interface ArithmeticConfig {
  operations: Operation[]
  ranges: Partial<Record<Operation, OperationRange>>
  duration: 30 | 60 | 120
}

export interface Problem {
  operandA: number
  operandB: number
  operation: Operation
  answer: number
  display: string
}

export interface GameResult {
  score: number
  totalAttempts: number
  accuracy: number
  problemsPerMinute: number
  duration: number
  configHash: string
}

export interface LeaderboardEntry {
  rank: number
  username: string | null
  score: number
  createdAt: string
}

export interface Profile {
  id: string
  username: string | null
  avatarUrl: string | null
  subscriptionStatus: string
  xp: number
  streak: number
  lastPlayed: string | null
  createdAt: string
}
```

- [ ] **Step 2: Add `hashConfig` to `lib/config-hash.ts`**

Append this export to the end of the existing file (keep `hashArithmeticConfig` intact):

```typescript
export async function hashConfig(obj: Record<string, unknown>): Promise<string> {
  const sorted = Object.fromEntries(Object.entries(obj).sort())
  const buffer = new TextEncoder().encode(JSON.stringify(sorted))
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```

- [ ] **Step 3: Update `lib/anti-cheat.ts`**

Replace the file entirely:

```typescript
// Max scores per mode. Duration key 0 = no configurable duration (mode-level check).
const MAX_SCORES: Record<string, Record<number, number>> = {
  arithmetic: { 30: 90, 60: 180, 120: 360 },
  'bubble-burst': { 0: 1200 },
  'falling-equations': { 0: 12000 },
  'number-hunt': { 0: 1450 },
}

export function isScorePlausible(
  mode: string,
  duration: number,
  score: number
): boolean {
  const max = MAX_SCORES[mode]?.[duration]
  if (max === undefined) return false
  return score >= 0 && score <= max
}
```

- [ ] **Step 4: Update `app/api/scores/route.ts`**

Two changes: expand ALLOWED_MODES and generalize the anti-cheat call:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isScorePlausible } from '@/lib/anti-cheat'

interface ScorePayload {
  mode: string
  configHash: string
  score: number
  accuracy: number
  metadata: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ScorePayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { mode, configHash, score, accuracy, metadata } = body

  const ALLOWED_MODES = ['arithmetic', 'bubble-burst', 'falling-equations', 'number-hunt'] as const
  if (!ALLOWED_MODES.includes(mode as typeof ALLOWED_MODES[number])) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }
  if (typeof configHash !== 'string' || !/^[a-f0-9]{64}$/.test(configHash)) {
    return NextResponse.json({ error: 'Invalid configHash' }, { status: 400 })
  }
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
  }
  if (typeof accuracy !== 'number' || accuracy < 0 || accuracy > 1) {
    return NextResponse.json({ error: 'Invalid accuracy' }, { status: 400 })
  }

  const duration = typeof metadata?.duration === 'number' ? metadata.duration : 0
  if (!isScorePlausible(mode, duration, score)) {
    return NextResponse.json({ error: 'Score rejected: implausible result' }, { status: 400 })
  }

  const { data: existingBest } = await supabase
    .from('scores')
    .select('score')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .eq('config_hash', configHash)
    .order('score', { ascending: false })
    .limit(1)
    .single()

  const previousBest = existingBest?.score ?? null
  const isPersonalBest = previousBest === null || score > previousBest

  const { error: insertError } = await supabase.from('scores').insert({
    user_id: user.id,
    mode,
    config_hash: configHash,
    score,
    accuracy,
    metadata,
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const [{ count: total }, { count: below }] = await Promise.all([
    supabase
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('mode', mode)
      .eq('config_hash', configHash),
    supabase
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('mode', mode)
      .eq('config_hash', configHash)
      .lt('score', score),
  ])

  const percentile = total && total > 0
    ? Math.round(((below ?? 0) / total) * 100)
    : null

  return NextResponse.json({ isPersonalBest, previousBest, percentile })
}
```

- [ ] **Step 5: Update `app/page.tsx`** — mark new modes available

```typescript
import { Calculator, Circle, Layers, Grid3X3 } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { GameCard } from '@/components/GameCard'

const GAME_MODES = [
  {
    title: 'Arithmetic Sprint',
    description: 'Race against the clock. How many problems can you solve?',
    icon: Calculator,
    href: '/play/arithmetic',
    available: true,
    badge: 'Play Now',
  },
  {
    title: 'Bubble Burst',
    description: 'Tap the correct answer before bubbles float away.',
    icon: Circle,
    href: '/play/bubble-burst',
    available: true,
    badge: 'Play Now',
  },
  {
    title: 'Falling Equations',
    description: 'Type answers before equation blocks hit the floor.',
    icon: Layers,
    href: '/play/falling-equations',
    available: true,
    badge: 'Play Now',
  },
  {
    title: 'Number Hunt',
    description: 'Find all the numbers matching the rule before time runs out.',
    icon: Grid3X3,
    href: '/play/number-hunt',
    available: true,
    badge: 'Play Now',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Train Your Brain
          </h1>
          <p className="text-lg text-muted-foreground">
            Your brain is about to thank you. Pick a mode.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {GAME_MODES.map(mode => (
            <GameCard key={mode.title} {...mode} />
          ))}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 6: Verify build and lint**

```bash
npm run build && npm run lint
```

Expected: both pass with no errors.

- [ ] **Step 7: Commit**

```bash
git add types/index.ts lib/config-hash.ts lib/anti-cheat.ts app/api/scores/route.ts app/page.tsx
git commit -m "feat: expand GameMode union and shared infrastructure for phase 2 modes"
```

---

## Task 2: Bubble Burst Engine (TDD)

**Files:**
- Create: `games/bubble-burst/engine.ts`
- Create: `games/bubble-burst/engine.test.ts`

**Interfaces:**
- Consumes: `Problem` from `@/types`, `generateProblem` from `games/arithmetic/engine.ts`, `hashConfig` from `lib/config-hash.ts`
- Produces:
  ```typescript
  interface Bubble { id: string; value: number; isCorrect: boolean; spawnDelay: number; floatDuration: number; x: number }
  interface Wave { waveNumber: number; problem: Problem; bubbles: Bubble[]; waveDuration: number }
  function generateWave(waveNumber: number): Wave
  function scoreBubbleTap(bubble: Bubble, tapTime: number, waveStartTime: number): number
  const WAVE_COUNT = 10
  const WAVE_DURATION = 20000
  const BUBBLE_BURST_CONFIG_HASH: Promise<string>
  ```

- [ ] **Step 1: Write failing tests in `games/bubble-burst/engine.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { generateWave, scoreBubbleTap, WAVE_COUNT, WAVE_DURATION } from './engine'

describe('generateWave', () => {
  it('wave 1 has 4 bubbles', () => {
    const wave = generateWave(1)
    expect(wave.bubbles).toHaveLength(4)
  })

  it('wave 1 has exactly 1 correct bubble', () => {
    const wave = generateWave(1)
    expect(wave.bubbles.filter(b => b.isCorrect)).toHaveLength(1)
  })

  it('wave 5 has more bubbles than wave 1', () => {
    const wave5 = generateWave(5)
    const wave1 = generateWave(1)
    expect(wave5.bubbles.length).toBeGreaterThan(wave1.bubbles.length)
  })

  it('wave 5 has 2 correct bubbles', () => {
    const wave = generateWave(5)
    expect(wave.bubbles.filter(b => b.isCorrect)).toHaveLength(2)
  })

  it('wave 7 has 3 correct bubbles', () => {
    const wave = generateWave(7)
    expect(wave.bubbles.filter(b => b.isCorrect)).toHaveLength(3)
  })

  it('all correct bubbles have the same value as problem answer', () => {
    const wave = generateWave(3)
    const correctBubbles = wave.bubbles.filter(b => b.isCorrect)
    correctBubbles.forEach(b => expect(b.value).toBe(wave.problem.answer))
  })

  it('distractor values differ from the correct answer', () => {
    const wave = generateWave(1)
    const distractors = wave.bubbles.filter(b => !b.isCorrect)
    distractors.forEach(b => expect(b.value).not.toBe(wave.problem.answer))
  })

  it('bubble x positions are within 10-90 range', () => {
    const wave = generateWave(1)
    wave.bubbles.forEach(b => {
      expect(b.x).toBeGreaterThanOrEqual(10)
      expect(b.x).toBeLessThanOrEqual(90)
    })
  })

  it('wave 10 has shorter float duration than wave 1', () => {
    const w1 = generateWave(1)
    const w10 = generateWave(10)
    expect(w10.bubbles[0].floatDuration).toBeLessThan(w1.bubbles[0].floatDuration)
  })

  it('float duration is at least 4000ms', () => {
    const wave = generateWave(10)
    wave.bubbles.forEach(b => expect(b.floatDuration).toBeGreaterThanOrEqual(4000))
  })

  it('wave duration is always WAVE_DURATION', () => {
    expect(generateWave(1).waveDuration).toBe(WAVE_DURATION)
    expect(generateWave(10).waveDuration).toBe(WAVE_DURATION)
  })

  it('WAVE_COUNT is 10', () => {
    expect(WAVE_COUNT).toBe(10)
  })
})

describe('scoreBubbleTap', () => {
  it('tapping immediately gives 10 points', () => {
    const wave = generateWave(1)
    const bubble = wave.bubbles[0]
    const waveStart = 1000
    const tapTime = waveStart + bubble.spawnDelay + 1
    const pts = scoreBubbleTap(bubble, tapTime, waveStart)
    expect(pts).toBe(10)
  })

  it('tapping at exactly float expiry gives 1 point', () => {
    const wave = generateWave(1)
    const bubble = wave.bubbles[0]
    const waveStart = 1000
    const tapTime = waveStart + bubble.spawnDelay + bubble.floatDuration
    const pts = scoreBubbleTap(bubble, tapTime, waveStart)
    expect(pts).toBe(1)
  })

  it('score is always between 1 and 10', () => {
    const wave = generateWave(1)
    const bubble = wave.bubbles[0]
    const waveStart = 0
    const midTap = waveStart + bubble.spawnDelay + bubble.floatDuration / 2
    const pts = scoreBubbleTap(bubble, midTap, waveStart)
    expect(pts).toBeGreaterThanOrEqual(1)
    expect(pts).toBeLessThanOrEqual(10)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run games/bubble-burst/engine.test.ts
```

Expected: FAIL — "Cannot find module './engine'"

- [ ] **Step 3: Implement `games/bubble-burst/engine.ts`**

```typescript
import { generateProblem } from '@/games/arithmetic/engine'
import { hashConfig } from '@/lib/config-hash'
import type { Problem } from '@/types'

export interface Bubble {
  id: string
  value: number
  isCorrect: boolean
  spawnDelay: number     // ms after wave start before this bubble appears
  floatDuration: number  // ms from spawn until it exits screen
  x: number             // horizontal position 10–90 (%)
}

export interface Wave {
  waveNumber: number
  problem: Problem
  bubbles: Bubble[]
  waveDuration: number
}

export const WAVE_COUNT = 10
export const WAVE_DURATION = 20000

// Config hash is constant (no user config for this mode)
export const BUBBLE_BURST_CONFIG_HASH: Promise<string> = hashConfig({ mode: 'bubble-burst', version: 1 })

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getBubbleCount(waveNumber: number): number {
  // Wave 1: 4, +1 per wave, capped at 14
  return Math.min(4 + (waveNumber - 1), 14)
}

function getCorrectCount(waveNumber: number): number {
  // Wave 1-2: 1 correct; +1 every 3 waves
  return 1 + Math.floor((waveNumber - 1) / 3)
}

function getFloatDuration(waveNumber: number): number {
  // Wave 1: 8000ms, -1000ms per wave, min 4000ms
  return Math.max(8000 - (waveNumber - 1) * 1000, 4000)
}

function getNumberRange(waveNumber: number): { min: number; max: number } {
  const max = Math.min(20 + (waveNumber - 1) * 5, 100)
  return { min: 1, max }
}

function generateDistractor(answer: number, range: { min: number; max: number }): number {
  let distractor: number
  do {
    distractor = randomInt(range.min, range.max + 20)
  } while (distractor === answer)
  return distractor
}

export function generateWave(waveNumber: number): Wave {
  const range = getNumberRange(waveNumber)
  const problem = generateProblem({
    operations: ['add', 'subtract', 'multiply'],
    ranges: {
      add: { min1: range.min, max1: range.max, min2: range.min, max2: range.max },
      subtract: { min1: range.min, max1: range.max, min2: range.min, max2: range.max },
      multiply: { min1: 1, max1: Math.min(range.max, 12), min2: 1, max2: Math.min(range.max, 12) },
    },
    duration: 60,
  })

  const bubbleCount = getBubbleCount(waveNumber)
  const correctCount = getCorrectCount(waveNumber)
  const floatDuration = getFloatDuration(waveNumber)
  const usedX: number[] = []

  function getUniqueX(): number {
    let x: number
    let attempts = 0
    do {
      x = randomInt(10, 90)
      attempts++
    } while (usedX.some(existing => Math.abs(existing - x) < 8) && attempts < 20)
    usedX.push(x)
    return x
  }

  const bubbles: Bubble[] = []

  // Add correct bubbles
  for (let i = 0; i < correctCount; i++) {
    bubbles.push({
      id: crypto.randomUUID(),
      value: problem.answer,
      isCorrect: true,
      spawnDelay: randomInt(0, 3000),
      floatDuration,
      x: getUniqueX(),
    })
  }

  // Add distractor bubbles
  for (let i = correctCount; i < bubbleCount; i++) {
    bubbles.push({
      id: crypto.randomUUID(),
      value: generateDistractor(problem.answer, range),
      isCorrect: false,
      spawnDelay: randomInt(0, 3000),
      floatDuration,
      x: getUniqueX(),
    })
  }

  return { waveNumber, problem, bubbles, waveDuration: WAVE_DURATION }
}

export function scoreBubbleTap(bubble: Bubble, tapTime: number, waveStartTime: number): number {
  const elapsed = tapTime - waveStartTime - bubble.spawnDelay
  const remaining = bubble.floatDuration - elapsed
  const fraction = Math.max(0, remaining / bubble.floatDuration)
  // Scale 1-10: fraction 1.0 → 10pts, fraction 0.0 → 1pt
  return Math.max(1, Math.round(fraction * 10))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run games/bubble-burst/engine.test.ts
```

Expected: All 14 tests PASS.

- [ ] **Step 5: Run full test suite, build, and lint**

```bash
npm test && npm run build && npm run lint
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add games/bubble-burst/engine.ts games/bubble-burst/engine.test.ts
git commit -m "feat: add Bubble Burst engine with TDD (14 tests passing)"
```

---

## Task 3: Bubble Burst UI (GameScreen + ResultsScreen + page)

**Files:**
- Create: `games/bubble-burst/GameScreen.tsx`
- Create: `games/bubble-burst/ResultsScreen.tsx`
- Create: `app/play/bubble-burst/page.tsx`

**Interfaces:**
- Consumes: `generateWave`, `scoreBubbleTap`, `WAVE_COUNT`, `WAVE_DURATION`, `BUBBLE_BURST_CONFIG_HASH`, `Wave`, `Bubble` from `./engine`; `GameResult` from `@/types`; `useAuth` from `@/components/AuthProvider`
- Produces: default export page at `/play/bubble-burst`

- [ ] **Step 1: Create `games/bubble-burst/GameScreen.tsx`**

```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateWave, scoreBubbleTap, WAVE_COUNT, WAVE_DURATION, BUBBLE_BURST_CONFIG_HASH } from './engine'
import type { Wave, Bubble } from './engine'
import type { GameResult } from '@/types'

interface GameScreenProps {
  onFinish: (result: GameResult) => void
}

export function GameScreen({ onFinish }: GameScreenProps) {
  const [waveNumber, setWaveNumber] = useState(1)
  const [wave, setWave] = useState<Wave>(() => generateWave(1))
  const [activeBubbles, setActiveBubbles] = useState<Bubble[]>([])
  const [score, setScore] = useState(0)
  const [waveTimeLeft, setWaveTimeLeft] = useState(WAVE_DURATION / 1000)
  const [burstIds, setBurstIds] = useState<Set<string>>(new Set())
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set())
  const waveStartTime = useRef<number>(0)
  const scoreRef = useRef(0)
  const waveRef = useRef<Wave>(wave)
  const gameOver = useRef(false)
  const totalTapsRef = useRef(0)
  const correctTapsRef = useRef(0)

  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { waveRef.current = wave }, [wave])

  // Spawn bubbles with delays
  useEffect(() => {
    waveStartTime.current = Date.now()
    const timeouts: ReturnType<typeof setTimeout>[] = []
    wave.bubbles.forEach(bubble => {
      const t = setTimeout(() => {
        setActiveBubbles(prev => [...prev, bubble])
      }, bubble.spawnDelay)
      timeouts.push(t)
    })
    return () => timeouts.forEach(clearTimeout)
  }, [wave])

  // Remove bubbles that float off screen
  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = []
    activeBubbles.forEach(bubble => {
      const elapsed = Date.now() - waveStartTime.current - bubble.spawnDelay
      const remaining = bubble.floatDuration - elapsed
      if (remaining > 0) {
        const t = setTimeout(() => {
          setActiveBubbles(prev => prev.filter(b => b.id !== bubble.id))
        }, remaining)
        timeouts.push(t)
      }
    })
    return () => timeouts.forEach(clearTimeout)
  }, [activeBubbles])

  // Wave timer
  useEffect(() => {
    setWaveTimeLeft(WAVE_DURATION / 1000)
    const id = setInterval(() => {
      setWaveTimeLeft(t => {
        if (t <= 1) { clearInterval(id); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [waveNumber])

  const finishGame = useCallback(async () => {
    if (gameOver.current) return
    gameOver.current = true
    const configHash = await BUBBLE_BURST_CONFIG_HASH
    onFinish({
      score: scoreRef.current,
      totalAttempts: totalTapsRef.current,
      accuracy: totalTapsRef.current === 0 ? 0 : correctTapsRef.current / totalTapsRef.current,
      problemsPerMinute: Math.round(correctTapsRef.current / ((WAVE_COUNT * WAVE_DURATION) / 1000 / 60)),
      duration: 0,
      configHash,
    })
  }, [onFinish])

  // Advance wave or finish game
  useEffect(() => {
    if (waveTimeLeft !== 0) return
    if (waveNumber >= WAVE_COUNT) {
      finishGame()
    } else {
      const nextWave = waveNumber + 1
      setWaveNumber(nextWave)
      setWave(generateWave(nextWave))
      setActiveBubbles([])
      setBurstIds(new Set())
      setErrorIds(new Set())
    }
  }, [waveTimeLeft, waveNumber, finishGame])

  function handleBubbleTap(bubble: Bubble) {
    if (burstIds.has(bubble.id) || errorIds.has(bubble.id)) return
    totalTapsRef.current += 1

    if (bubble.isCorrect) {
      correctTapsRef.current += 1
      const pts = scoreBubbleTap(bubble, Date.now(), waveStartTime.current)
      setScore(s => s + pts)
      setBurstIds(prev => new Set(prev).add(bubble.id))
      setTimeout(() => {
        setActiveBubbles(prev => prev.filter(b => b.id !== bubble.id))
      }, 300)
    } else {
      setErrorIds(prev => new Set(prev).add(bubble.id))
      setTimeout(() => {
        setActiveBubbles(prev => prev.filter(b => b.id !== bubble.id))
        setErrorIds(prev => { const s = new Set(prev); s.delete(bubble.id); return s })
      }, 400)
    }
  }

  return (
    <div className="relative w-full max-w-lg mx-auto" style={{ height: '70vh', minHeight: 500 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">Wave {waveNumber}/{WAVE_COUNT}</div>
        <div className="text-3xl font-bold tabular-nums">{score}</div>
        <div className={`text-sm font-mono font-bold ${waveTimeLeft <= 5 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {waveTimeLeft}s
        </div>
      </div>

      {/* Problem */}
      <div className="text-center text-4xl font-bold mb-2 tracking-tight">
        {wave.problem.display} = ?
      </div>

      {/* Bubble field */}
      <div className="relative flex-1" style={{ height: 'calc(100% - 120px)' }}>
        <AnimatePresence>
          {activeBubbles.map(bubble => (
            <motion.button
              key={bubble.id}
              initial={{ y: '100%', opacity: 1 }}
              animate={{
                y: '-120%',
                opacity: errorIds.has(bubble.id) ? 0 : 1,
              }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: bubble.floatDuration / 1000, ease: 'linear' }}
              onClick={() => handleBubbleTap(bubble)}
              className={`
                absolute flex items-center justify-center
                w-16 h-16 rounded-full text-xl font-bold
                min-h-[64px] min-w-[64px]
                border-2 transition-colors
                ${burstIds.has(bubble.id)
                  ? 'bg-green-500 border-green-400 text-white scale-125'
                  : errorIds.has(bubble.id)
                    ? 'bg-destructive border-destructive text-white'
                    : 'bg-card border-primary text-foreground hover:bg-primary hover:text-primary-foreground'
                }
              `}
              style={{ left: `${bubble.x}%`, transform: 'translateX(-50%)' }}
            >
              {bubble.value}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `games/bubble-burst/ResultsScreen.tsx`**

```typescript
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import { Trophy, Target, Zap, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AuthModal } from '@/components/AuthModal'
import { useAuth } from '@/components/AuthProvider'
import type { GameResult } from '@/types'

interface ResultsScreenProps {
  result: GameResult
  onPlayAgain: () => void
}

interface SavedData {
  isPersonalBest: boolean
  percentile: number | null
  previousBest: number | null
}

export function ResultsScreen({ result, onPlayAgain }: ResultsScreenProps) {
  const { user } = useAuth()
  const [savedData, setSavedData] = useState<SavedData | null>(null)
  const [saving, setSaving] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const hasSaved = useRef(false)

  const saveScore = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'bubble-burst',
          configHash: result.configHash,
          score: result.score,
          accuracy: result.accuracy,
          metadata: { duration: 0 },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedData(data)
        if (data.isPersonalBest) {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
        }
      }
    } finally {
      setSaving(false)
    }
  }, [result])

  useEffect(() => {
    if (hasSaved.current) return
    if (!user) return
    hasSaved.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    saveScore()
  }, [user, saveScore])

  const stats = [
    { icon: Trophy, label: 'Score', value: result.score, color: 'text-yellow-500' },
    { icon: Target, label: 'Accuracy', value: `${Math.round(result.accuracy * 100)}%`, color: 'text-blue-500' },
    { icon: Zap, label: 'Per min', value: result.problemsPerMinute, color: 'text-green-500' },
  ]

  return (
    <div className="max-w-sm mx-auto space-y-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="text-center"
      >
        <div className="text-7xl font-bold tabular-nums mb-2">{result.score}</div>
        <div className="text-muted-foreground">points across 10 waves</div>

        {savedData?.isPersonalBest && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-primary font-semibold"
          >
            New personal best!
          </motion.div>
        )}

        {savedData?.percentile != null && (
          <div className="mt-1 text-sm text-muted-foreground">
            Better than {savedData.percentile}% of players
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3 text-center">
              <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
              <div className="text-xl font-bold tabular-nums">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!user && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-3 text-center space-y-2">
            <p className="text-sm font-medium">Log in to save your score and climb the leaderboard.</p>
            <Button size="sm" onClick={() => setAuthOpen(true)}>
              Log In / Sign Up
            </Button>
          </CardContent>
        </Card>
      )}

      {saving && (
        <p className="text-center text-sm text-muted-foreground">Saving score…</p>
      )}

      <Button onClick={onPlayAgain} className="w-full gap-2 min-h-[44px]">
        <RefreshCw className="h-4 w-4" />
        Play Again
      </Button>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  )
}
```

- [ ] **Step 3: Create `app/play/bubble-burst/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SiteHeader } from '@/components/SiteHeader'
import { GameScreen } from '@/games/bubble-burst/GameScreen'
import { ResultsScreen } from '@/games/bubble-burst/ResultsScreen'
import type { GameResult } from '@/types'

type GamePhase = 'playing' | 'results'

export default function BubbleBurstPage() {
  const [phase, setPhase] = useState<GamePhase>('playing')
  const [result, setResult] = useState<GameResult | null>(null)

  function handleFinish(gameResult: GameResult) {
    setResult(gameResult)
    setPhase('results')
  }

  function handlePlayAgain() {
    setResult(null)
    setPhase('playing')
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container max-w-2xl mx-auto px-4 py-8">
        {phase !== 'playing' && (
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 mb-6">
              <ArrowLeft className="h-4 w-4" />
              Back to hub
            </Button>
          </Link>
        )}

        {phase === 'playing' && (
          <GameScreen onFinish={handleFinish} />
        )}

        {phase === 'results' && result && (
          <ResultsScreen result={result} onPlayAgain={handlePlayAgain} />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Build and lint**

```bash
npm run build && npm run lint
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add games/bubble-burst/GameScreen.tsx games/bubble-burst/ResultsScreen.tsx app/play/bubble-burst/page.tsx
git commit -m "feat: add Bubble Burst game screen, results screen, and page"
```

---

## Task 4: Falling Equations Engine (TDD)

**Files:**
- Create: `games/falling-equations/engine.ts`
- Create: `games/falling-equations/engine.test.ts`

**Interfaces:**
- Consumes: `generateProblem` from `games/arithmetic/engine.ts`, `hashConfig` from `lib/config-hash.ts`
- Produces:
  ```typescript
  interface FallingBlock { id: string; problem: Problem; spawnTime: number; fallDuration: number }
  function getLevel(correctCount: number): number
  function getFallDuration(level: number): number
  function getEquationCount(level: number): number
  function generateBlock(level: number): FallingBlock
  function scoreBlockAnswer(block: FallingBlock, answerTime: number): number
  const FALLING_EQUATIONS_CONFIG_HASH: Promise<string>
  ```

- [ ] **Step 1: Write failing tests in `games/falling-equations/engine.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { getLevel, getFallDuration, getEquationCount, generateBlock, scoreBlockAnswer } from './engine'

describe('getLevel', () => {
  it('level 1 at 0 correct', () => expect(getLevel(0)).toBe(1))
  it('level 1 at 4 correct', () => expect(getLevel(4)).toBe(1))
  it('level 2 at 5 correct', () => expect(getLevel(5)).toBe(2))
  it('level 3 at 10 correct', () => expect(getLevel(10)).toBe(3))
  it('level 6 at 25 correct', () => expect(getLevel(25)).toBe(6))
})

describe('getFallDuration', () => {
  it('level 1 is 20000ms', () => expect(getFallDuration(1)).toBe(20000))
  it('level 2 is 16000ms', () => expect(getFallDuration(2)).toBe(16000))
  it('level 3 is 13000ms', () => expect(getFallDuration(3)).toBe(13000))
  it('level 4 is 10000ms', () => expect(getFallDuration(4)).toBe(10000))
  it('level 5 and above is 8000ms', () => {
    expect(getFallDuration(5)).toBe(8000)
    expect(getFallDuration(10)).toBe(8000)
  })
})

describe('getEquationCount', () => {
  it('1 equation for levels 1-4', () => {
    expect(getEquationCount(1)).toBe(1)
    expect(getEquationCount(4)).toBe(1)
  })
  it('2 equations from level 5', () => {
    expect(getEquationCount(5)).toBe(2)
    expect(getEquationCount(10)).toBe(2)
  })
})

describe('generateBlock', () => {
  it('returns a block with a problem and fallDuration', () => {
    const block = generateBlock(1)
    expect(block.id).toBeTruthy()
    expect(block.problem).toBeDefined()
    expect(block.problem.answer).toBeTypeOf('number')
    expect(block.fallDuration).toBe(getFallDuration(1))
  })

  it('uses level-appropriate fall duration', () => {
    const block5 = generateBlock(5)
    expect(block5.fallDuration).toBe(getFallDuration(5))
  })
})

describe('scoreBlockAnswer', () => {
  it('answering immediately gives close to 100 points', () => {
    const block = generateBlock(1)
    block.spawnTime = 0
    const pts = scoreBlockAnswer(block, 100)
    expect(pts).toBeGreaterThan(95)
  })

  it('answering at halfway gives around 50 points', () => {
    const block = generateBlock(1)
    block.spawnTime = 0
    const pts = scoreBlockAnswer(block, block.fallDuration / 2)
    expect(pts).toBeGreaterThanOrEqual(45)
    expect(pts).toBeLessThanOrEqual(55)
  })

  it('score is always between 1 and 100', () => {
    const block = generateBlock(1)
    block.spawnTime = 0
    expect(scoreBlockAnswer(block, 0)).toBeLessThanOrEqual(100)
    expect(scoreBlockAnswer(block, block.fallDuration + 1000)).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run games/falling-equations/engine.test.ts
```

Expected: FAIL — "Cannot find module './engine'"

- [ ] **Step 3: Implement `games/falling-equations/engine.ts`**

```typescript
import { generateProblem } from '@/games/arithmetic/engine'
import { hashConfig } from '@/lib/config-hash'
import type { Problem } from '@/types'

export interface FallingBlock {
  id: string
  problem: Problem
  spawnTime: number
  fallDuration: number
}

export const FALLING_EQUATIONS_CONFIG_HASH: Promise<string> = hashConfig({
  mode: 'falling-equations',
  version: 1,
})

const FALL_DURATIONS: Record<number, number> = {
  1: 20000,
  2: 16000,
  3: 13000,
  4: 10000,
}

export function getLevel(correctCount: number): number {
  return Math.floor(correctCount / 5) + 1
}

export function getFallDuration(level: number): number {
  return FALL_DURATIONS[level] ?? 8000
}

export function getEquationCount(level: number): number {
  return level >= 5 ? 2 : 1
}

function getRange(level: number): { min: number; max: number } {
  const max = Math.min(10 + (level - 1) * 5, 50)
  return { min: 1, max }
}

export function generateBlock(level: number): FallingBlock {
  const range = getRange(level)
  const problem = generateProblem({
    operations: ['add', 'subtract', 'multiply'],
    ranges: {
      add: { min1: range.min, max1: range.max, min2: range.min, max2: range.max },
      subtract: { min1: range.min, max1: range.max, min2: range.min, max2: range.max },
      multiply: { min1: 1, max1: Math.min(range.max, 12), min2: 1, max2: Math.min(range.max, 12) },
    },
    duration: 60,
  })

  return {
    id: crypto.randomUUID(),
    problem,
    spawnTime: Date.now(),
    fallDuration: getFallDuration(level),
  }
}

export function scoreBlockAnswer(block: FallingBlock, answerTime: number): number {
  const elapsed = answerTime - block.spawnTime
  const remaining = block.fallDuration - elapsed
  const fraction = Math.max(0, remaining / block.fallDuration)
  return Math.max(1, Math.round(fraction * 100))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run games/falling-equations/engine.test.ts
```

Expected: All 15 tests PASS.

- [ ] **Step 5: Run full test suite, build, and lint**

```bash
npm test && npm run build && npm run lint
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add games/falling-equations/engine.ts games/falling-equations/engine.test.ts
git commit -m "feat: add Falling Equations engine with TDD (15 tests passing)"
```

---

## Task 5: Falling Equations UI (GameScreen + ResultsScreen + page)

**Files:**
- Create: `games/falling-equations/GameScreen.tsx`
- Create: `games/falling-equations/ResultsScreen.tsx`
- Create: `app/play/falling-equations/page.tsx`

**Interfaces:**
- Consumes: `generateBlock`, `getLevel`, `getEquationCount`, `getFallDuration`, `scoreBlockAnswer`, `FallingBlock`, `FALLING_EQUATIONS_CONFIG_HASH` from `./engine`
- Produces: default export page at `/play/falling-equations`

- [ ] **Step 1: Create `games/falling-equations/GameScreen.tsx`**

```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateBlock, getLevel, getEquationCount, scoreBlockAnswer, FALLING_EQUATIONS_CONFIG_HASH } from './engine'
import type { FallingBlock } from './engine'
import type { GameResult } from '@/types'

interface GameScreenProps {
  onFinish: (result: GameResult) => void
}

const STARTING_LIVES = 3

export function GameScreen({ onFinish }: GameScreenProps) {
  const [blocks, setBlocks] = useState<FallingBlock[]>([])
  const [lives, setLives] = useState(STARTING_LIVES)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [input, setInput] = useState('')
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scoreRef = useRef(0)
  const correctRef = useRef(0)
  const totalAttemptsRef = useRef(0)
  const livesRef = useRef(STARTING_LIVES)
  const gameOver = useRef(false)
  const gameStartTime = useRef(Date.now())

  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { correctRef.current = correctCount }, [correctCount])
  useEffect(() => { livesRef.current = lives }, [lives])

  const finishGame = useCallback(async () => {
    if (gameOver.current) return
    gameOver.current = true
    const configHash = await FALLING_EQUATIONS_CONFIG_HASH
    const elapsedMin = (Date.now() - gameStartTime.current) / 1000 / 60
    onFinish({
      score: scoreRef.current,
      totalAttempts: totalAttemptsRef.current,
      accuracy: totalAttemptsRef.current === 0 ? 0 : correctRef.current / totalAttemptsRef.current,
      problemsPerMinute: Math.round(correctRef.current / Math.max(elapsedMin, 0.001)),
      duration: 0,
      configHash,
    })
  }, [onFinish])

  // Spawn blocks based on level
  const spawnBlock = useCallback(() => {
    const level = getLevel(correctRef.current)
    setBlocks(prev => {
      const count = getEquationCount(level)
      if (prev.length >= count) return prev
      return [...prev, generateBlock(level)]
    })
  }, [])

  useEffect(() => {
    spawnBlock()
    inputRef.current?.focus()
  }, [spawnBlock])

  // Set up floor-hit detection per block
  useEffect(() => {
    if (blocks.length === 0) return
    const timeouts: ReturnType<typeof setTimeout>[] = []
    blocks.forEach(block => {
      const elapsed = Date.now() - block.spawnTime
      const remaining = block.fallDuration - elapsed
      if (remaining > 0) {
        const t = setTimeout(() => {
          if (gameOver.current) return
          setBlocks(prev => prev.filter(b => b.id !== block.id))
          setLives(l => {
            const next = l - 1
            if (next <= 0) finishGame()
            return next
          })
          spawnBlock()
        }, remaining)
        timeouts.push(t)
      }
    })
    return () => timeouts.forEach(clearTimeout)
  }, [blocks, finishGame, spawnBlock])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !input) return

    totalAttemptsRef.current += 1
    const activeBlock = blocks[0]
    if (!activeBlock) return

    const parsed = parseInt(input, 10)
    if (!isNaN(parsed) && parsed === activeBlock.problem.answer) {
      const pts = scoreBlockAnswer(activeBlock, Date.now())
      setScore(s => s + pts)
      setCorrectCount(c => c + 1)
      setInput('')
      setBlocks(prev => prev.filter(b => b.id !== activeBlock.id))
      spawnBlock()
    } else {
      setShake(true)
      setInput('')
      setTimeout(() => {
        setShake(false)
        inputRef.current?.focus()
      }, 350)
    }
  }

  const level = getLevel(correctCount)

  return (
    <div className="max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-muted-foreground">Level {level}</div>
        <div className="text-3xl font-bold tabular-nums">{score}</div>
        <div className="flex gap-1">
          {Array.from({ length: STARTING_LIVES }).map((_, i) => (
            <span key={i} className={`text-xl ${i < lives ? 'text-red-500' : 'text-muted'}`}>
              ♥
            </span>
          ))}
        </div>
      </div>

      {/* Fall arena */}
      <div
        className="relative bg-muted/20 rounded-2xl border border-muted overflow-hidden mb-6"
        style={{ height: 340 }}
      >
        <AnimatePresence>
          {blocks.map(block => {
            const elapsed = Date.now() - block.spawnTime
            const fraction = Math.max(0, 1 - elapsed / block.fallDuration)
            const startY = `${(1 - fraction) * 80}%`
            return (
              <motion.div
                key={block.id}
                initial={{ y: '0%' }}
                animate={{ y: '82%' }}
                transition={{ duration: block.fallDuration / 1000, ease: 'linear' }}
                className="absolute left-1/2 -translate-x-1/2 bg-card border-2 border-primary rounded-xl px-6 py-3 text-2xl font-bold text-center shadow-md"
                style={{ top: startY }}
              >
                {block.problem.display} = ?
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Floor indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-destructive/50 rounded" />
      </div>

      {/* Input */}
      <motion.input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        animate={shake ? { x: [-6, 6, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.3 }}
        className={`
          w-full text-center text-3xl font-mono font-bold
          bg-muted rounded-2xl border-2 py-4 px-6
          focus:outline-none focus:border-primary transition-colors
          min-h-[64px]
          ${shake ? 'border-destructive' : 'border-transparent'}
        `}
        placeholder="answer + Enter"
        autoComplete="off"
      />
    </div>
  )
}
```

- [ ] **Step 2: Create `games/falling-equations/ResultsScreen.tsx`**

```typescript
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import { Trophy, Target, Zap, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AuthModal } from '@/components/AuthModal'
import { useAuth } from '@/components/AuthProvider'
import type { GameResult } from '@/types'

interface ResultsScreenProps {
  result: GameResult
  onPlayAgain: () => void
}

interface SavedData {
  isPersonalBest: boolean
  percentile: number | null
  previousBest: number | null
}

export function ResultsScreen({ result, onPlayAgain }: ResultsScreenProps) {
  const { user } = useAuth()
  const [savedData, setSavedData] = useState<SavedData | null>(null)
  const [saving, setSaving] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const hasSaved = useRef(false)

  const saveScore = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'falling-equations',
          configHash: result.configHash,
          score: result.score,
          accuracy: result.accuracy,
          metadata: { duration: 0 },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedData(data)
        if (data.isPersonalBest) {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
        }
      }
    } finally {
      setSaving(false)
    }
  }, [result])

  useEffect(() => {
    if (hasSaved.current) return
    if (!user) return
    hasSaved.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    saveScore()
  }, [user, saveScore])

  const stats = [
    { icon: Trophy, label: 'Score', value: result.score, color: 'text-yellow-500' },
    { icon: Target, label: 'Accuracy', value: `${Math.round(result.accuracy * 100)}%`, color: 'text-blue-500' },
    { icon: Zap, label: 'Per min', value: result.problemsPerMinute, color: 'text-green-500' },
  ]

  return (
    <div className="max-w-sm mx-auto space-y-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="text-center"
      >
        <div className="text-7xl font-bold tabular-nums mb-2">{result.score}</div>
        <div className="text-muted-foreground">points before the floor got you</div>

        {savedData?.isPersonalBest && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-primary font-semibold"
          >
            New personal best!
          </motion.div>
        )}

        {savedData?.percentile != null && (
          <div className="mt-1 text-sm text-muted-foreground">
            Better than {savedData.percentile}% of players
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3 text-center">
              <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
              <div className="text-xl font-bold tabular-nums">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!user && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-3 text-center space-y-2">
            <p className="text-sm font-medium">Log in to save your score and climb the leaderboard.</p>
            <Button size="sm" onClick={() => setAuthOpen(true)}>
              Log In / Sign Up
            </Button>
          </CardContent>
        </Card>
      )}

      {saving && (
        <p className="text-center text-sm text-muted-foreground">Saving score…</p>
      )}

      <Button onClick={onPlayAgain} className="w-full gap-2 min-h-[44px]">
        <RefreshCw className="h-4 w-4" />
        Play Again
      </Button>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  )
}
```

- [ ] **Step 3: Create `app/play/falling-equations/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SiteHeader } from '@/components/SiteHeader'
import { GameScreen } from '@/games/falling-equations/GameScreen'
import { ResultsScreen } from '@/games/falling-equations/ResultsScreen'
import type { GameResult } from '@/types'

type GamePhase = 'playing' | 'results'

export default function FallingEquationsPage() {
  const [phase, setPhase] = useState<GamePhase>('playing')
  const [result, setResult] = useState<GameResult | null>(null)

  function handleFinish(gameResult: GameResult) {
    setResult(gameResult)
    setPhase('results')
  }

  function handlePlayAgain() {
    setResult(null)
    setPhase('playing')
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container max-w-2xl mx-auto px-4 py-8">
        {phase !== 'playing' && (
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 mb-6">
              <ArrowLeft className="h-4 w-4" />
              Back to hub
            </Button>
          </Link>
        )}

        {phase === 'playing' && (
          <GameScreen onFinish={handleFinish} />
        )}

        {phase === 'results' && result && (
          <ResultsScreen result={result} onPlayAgain={handlePlayAgain} />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Build and lint**

```bash
npm run build && npm run lint
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add games/falling-equations/GameScreen.tsx games/falling-equations/ResultsScreen.tsx app/play/falling-equations/page.tsx
git commit -m "feat: add Falling Equations game screen, results screen, and page"
```

---

## Task 6: Number Hunt Engine (TDD)

**Files:**
- Create: `games/number-hunt/engine.ts`
- Create: `games/number-hunt/engine.test.ts`

**Interfaces:**
- Consumes: `hashConfig` from `lib/config-hash.ts`
- Produces:
  ```typescript
  type Rule = { type: 'multiple'; n: number } | { type: 'greaterThan'; value: number } | { type: 'lessThan'; value: number } | { type: 'even' } | { type: 'odd' } | { type: 'square' } | { type: 'compound'; a: Rule; b: Rule }
  interface HuntGrid { numbers: number[]; rule: Rule; correctIndices: Set<number>; roundDuration: number }
  function generateGrid(round: number): HuntGrid
  function describeRule(rule: Rule): string
  function checkAnswer(index: number, grid: HuntGrid): boolean
  const ROUND_COUNT = 10
  const NUMBER_HUNT_CONFIG_HASH: Promise<string>
  ```

- [ ] **Step 1: Write failing tests in `games/number-hunt/engine.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { generateGrid, describeRule, checkAnswer, ROUND_COUNT } from './engine'

describe('generateGrid', () => {
  it('produces 25 numbers', () => {
    const grid = generateGrid(1)
    expect(grid.numbers).toHaveLength(25)
  })

  it('has at least 2 correct answers', () => {
    const grid = generateGrid(1)
    expect(grid.correctIndices.size).toBeGreaterThanOrEqual(2)
  })

  it('does not have all 25 numbers correct', () => {
    const grid = generateGrid(1)
    expect(grid.correctIndices.size).toBeLessThan(25)
  })

  it('correctIndices match the rule', () => {
    const grid = generateGrid(1)
    grid.correctIndices.forEach(i => {
      expect(checkAnswer(i, grid)).toBe(true)
    })
  })

  it('non-correct indices do not match the rule', () => {
    const grid = generateGrid(1)
    grid.numbers.forEach((_, i) => {
      if (!grid.correctIndices.has(i)) {
        expect(checkAnswer(i, grid)).toBe(false)
      }
    })
  })

  it('later rounds have shorter roundDuration', () => {
    const r1 = generateGrid(1)
    const r9 = generateGrid(9)
    expect(r9.roundDuration).toBeLessThan(r1.roundDuration)
  })

  it('roundDuration is at least 8000ms', () => {
    const grid = generateGrid(10)
    expect(grid.roundDuration).toBeGreaterThanOrEqual(8000)
  })

  it('ROUND_COUNT is 10', () => {
    expect(ROUND_COUNT).toBe(10)
  })
})

describe('describeRule', () => {
  it('describes even rule', () => {
    expect(describeRule({ type: 'even' })).toMatch(/even/i)
  })

  it('describes odd rule', () => {
    expect(describeRule({ type: 'odd' })).toMatch(/odd/i)
  })

  it('describes multiple rule', () => {
    expect(describeRule({ type: 'multiple', n: 7 })).toMatch(/7/)
  })

  it('describes greaterThan rule', () => {
    expect(describeRule({ type: 'greaterThan', value: 20 })).toMatch(/20/)
  })

  it('describes lessThan rule', () => {
    expect(describeRule({ type: 'lessThan', value: 15 })).toMatch(/15/)
  })

  it('describes square rule', () => {
    expect(describeRule({ type: 'square' })).toMatch(/square|perfect/i)
  })

  it('describes compound rule', () => {
    const compound = { type: 'compound' as const, a: { type: 'even' as const }, b: { type: 'multiple' as const, n: 3 } }
    const desc = describeRule(compound)
    expect(desc).toMatch(/even/i)
    expect(desc).toMatch(/3/)
  })
})

describe('checkAnswer', () => {
  it('correctly identifies multiples', () => {
    const grid = generateGrid(1)
    // Force a known rule for testing
    const testGrid = {
      ...grid,
      numbers: [3, 7, 9, 4, 6],
      rule: { type: 'multiple' as const, n: 3 },
      correctIndices: new Set([0, 2, 4]),
    }
    expect(checkAnswer(0, testGrid)).toBe(true)  // 3
    expect(checkAnswer(1, testGrid)).toBe(false) // 7
    expect(checkAnswer(2, testGrid)).toBe(true)  // 9
  })

  it('correctly identifies even numbers', () => {
    const testGrid = {
      numbers: [2, 3, 4, 5],
      rule: { type: 'even' as const },
      correctIndices: new Set([0, 2]),
      roundDuration: 15000,
    }
    expect(checkAnswer(0, testGrid)).toBe(true)  // 2
    expect(checkAnswer(1, testGrid)).toBe(false) // 3
  })

  it('correctly identifies squares', () => {
    const testGrid = {
      numbers: [4, 5, 9, 10, 16],
      rule: { type: 'square' as const },
      correctIndices: new Set([0, 2, 4]),
      roundDuration: 15000,
    }
    expect(checkAnswer(0, testGrid)).toBe(true)  // 4
    expect(checkAnswer(1, testGrid)).toBe(false) // 5
    expect(checkAnswer(2, testGrid)).toBe(true)  // 9
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run games/number-hunt/engine.test.ts
```

Expected: FAIL — "Cannot find module './engine'"

- [ ] **Step 3: Implement `games/number-hunt/engine.ts`**

```typescript
import { hashConfig } from '@/lib/config-hash'

export type Rule =
  | { type: 'multiple'; n: number }
  | { type: 'greaterThan'; value: number }
  | { type: 'lessThan'; value: number }
  | { type: 'even' }
  | { type: 'odd' }
  | { type: 'square' }
  | { type: 'compound'; a: Rule; b: Rule }

export interface HuntGrid {
  numbers: number[]
  rule: Rule
  correctIndices: Set<number>
  roundDuration: number
}

export const ROUND_COUNT = 10
export const NUMBER_HUNT_CONFIG_HASH: Promise<string> = hashConfig({ mode: 'number-hunt', version: 1 })

const SQUARES = new Set([1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144])

function satisfiesRule(n: number, rule: Rule): boolean {
  switch (rule.type) {
    case 'multiple': return n % rule.n === 0
    case 'greaterThan': return n > rule.value
    case 'lessThan': return n < rule.value
    case 'even': return n % 2 === 0
    case 'odd': return n % 2 !== 0
    case 'square': return SQUARES.has(n)
    case 'compound': return satisfiesRule(n, rule.a) && satisfiesRule(n, rule.b)
  }
}

export function describeRule(rule: Rule): string {
  switch (rule.type) {
    case 'multiple': return `Multiples of ${rule.n}`
    case 'greaterThan': return `Numbers greater than ${rule.value}`
    case 'lessThan': return `Numbers less than ${rule.value}`
    case 'even': return 'Even numbers'
    case 'odd': return 'Odd numbers'
    case 'square': return 'Perfect squares'
    case 'compound': return `${describeRule(rule.a)} and ${describeRule(rule.b).toLowerCase()}`
  }
}

export function checkAnswer(index: number, grid: HuntGrid): boolean {
  return satisfiesRule(grid.numbers[index], grid.rule)
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getRoundDuration(round: number): number {
  // Round 1: 15000ms, -1000ms per round (rounds 2-7), min 8000ms
  return Math.max(15000 - (round - 1) * 1000, 8000)
}

function getRule(round: number): Rule {
  const simpleRules: Rule[] = [
    { type: 'even' },
    { type: 'odd' },
    { type: 'multiple', n: 2 },
    { type: 'multiple', n: 3 },
  ]
  const medRules: Rule[] = [
    { type: 'multiple', n: 4 },
    { type: 'multiple', n: 5 },
    { type: 'greaterThan', value: randomInt(15, 30) },
    { type: 'lessThan', value: randomInt(20, 40) },
  ]
  const hardRules: Rule[] = [
    { type: 'multiple', n: 6 },
    { type: 'multiple', n: 7 },
    { type: 'square' },
    { type: 'greaterThan', value: randomInt(40, 70) },
  ]
  const veryHardRules: Rule[] = [
    { type: 'multiple', n: 8 },
    { type: 'multiple', n: 9 },
    { type: 'compound', a: { type: 'even' }, b: { type: 'multiple', n: 3 } },
    { type: 'compound', a: { type: 'multiple', n: 2 }, b: { type: 'greaterThan', value: randomInt(30, 50) } },
  ]

  let pool: Rule[]
  if (round <= 2) pool = simpleRules
  else if (round <= 4) pool = medRules
  else if (round <= 7) pool = hardRules
  else pool = veryHardRules

  return pool[Math.floor(Math.random() * pool.length)]
}

function getNumberRange(round: number): { min: number; max: number } {
  const max = Math.min(30 + (round - 1) * 15, 180)
  return { min: 1, max }
}

export function generateGrid(round: number): HuntGrid {
  const range = getNumberRange(round)
  const rule = getRule(round)

  let attempts = 0
  let numbers: number[]
  let correctIndices: Set<number>

  do {
    numbers = Array.from({ length: 25 }, () => randomInt(range.min, range.max))
    correctIndices = new Set(
      numbers.map((n, i) => (satisfiesRule(n, rule) ? i : -1)).filter(i => i >= 0)
    )
    attempts++
    // Retry if too few (<2) or too many (>20) correct
  } while ((correctIndices.size < 2 || correctIndices.size > 20) && attempts < 50)

  return {
    numbers,
    rule,
    correctIndices,
    roundDuration: getRoundDuration(round),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run games/number-hunt/engine.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite, build, and lint**

```bash
npm test && npm run build && npm run lint
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add games/number-hunt/engine.ts games/number-hunt/engine.test.ts
git commit -m "feat: add Number Hunt engine with TDD"
```

---

## Task 7: Number Hunt UI (GameScreen + ResultsScreen + page)

**Files:**
- Create: `games/number-hunt/GameScreen.tsx`
- Create: `games/number-hunt/ResultsScreen.tsx`
- Create: `app/play/number-hunt/page.tsx`

**Interfaces:**
- Consumes: `generateGrid`, `checkAnswer`, `describeRule`, `ROUND_COUNT`, `NUMBER_HUNT_CONFIG_HASH`, `HuntGrid` from `./engine`
- Produces: default export page at `/play/number-hunt`

- [ ] **Step 1: Create `games/number-hunt/GameScreen.tsx`**

```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateGrid, checkAnswer, describeRule, ROUND_COUNT, NUMBER_HUNT_CONFIG_HASH } from './engine'
import type { HuntGrid } from './engine'
import type { GameResult } from '@/types'

interface GameScreenProps {
  onFinish: (result: GameResult) => void
}

export function GameScreen({ onFinish }: GameScreenProps) {
  const [round, setRound] = useState(1)
  const [grid, setGrid] = useState<HuntGrid>(() => generateGrid(1))
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [flashRed, setFlashRed] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [roundScore, setRoundScore] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const totalScoreRef = useRef(0)
  const roundRef = useRef(1)
  const correctTapsRef = useRef(0)
  const totalTapsRef = useRef(0)
  const gameOver = useRef(false)
  const advancingRound = useRef(false)

  useEffect(() => { totalScoreRef.current = totalScore }, [totalScore])
  useEffect(() => { roundRef.current = round }, [round])

  useEffect(() => {
    setTimeLeft(Math.round(grid.roundDuration / 1000))
    setSelected(new Set())
    setRoundScore(0)
    advancingRound.current = false
  }, [grid])

  const finishGame = useCallback(async () => {
    if (gameOver.current) return
    gameOver.current = true
    const configHash = await NUMBER_HUNT_CONFIG_HASH
    onFinish({
      score: totalScoreRef.current,
      totalAttempts: totalTapsRef.current,
      accuracy: totalTapsRef.current === 0 ? 0 : correctTapsRef.current / totalTapsRef.current,
      problemsPerMinute: Math.round(correctTapsRef.current / ((ROUND_COUNT * 12) / 60)),
      duration: 0,
      configHash,
    })
  }, [onFinish])

  const advanceRound = useCallback((currentGrid: HuntGrid, currentSelected: Set<number>, currentTimeLeft: number, currentRoundScore: number) => {
    if (advancingRound.current || gameOver.current) return
    advancingRound.current = true

    const bonus = Math.round(currentTimeLeft * 3)
    const finalRoundScore = currentRoundScore + bonus
    const newTotal = totalScoreRef.current + finalRoundScore
    setTotalScore(newTotal)
    totalScoreRef.current = newTotal

    if (roundRef.current >= ROUND_COUNT) {
      setTimeout(() => finishGame(), 400)
    } else {
      setTimeout(() => {
        const nextRound = roundRef.current + 1
        setRound(nextRound)
        setGrid(generateGrid(nextRound))
      }, 600)
    }
  }, [finishGame])

  // Check if all correct answers are tapped
  useEffect(() => {
    if (selected.size === 0) return
    const allCorrectFound = [...grid.correctIndices].every(i => selected.has(i))
    if (allCorrectFound && !advancingRound.current) {
      advanceRound(grid, selected, timeLeft, roundScore)
    }
  }, [selected, grid, timeLeft, roundScore, advanceRound])

  // Round timer
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id)
          if (!advancingRound.current) advanceRound(grid, selected, 0, roundScore)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [grid, selected, roundScore, advanceRound])

  function handleCellTap(index: number) {
    if (selected.has(index) || flashRed === index || advancingRound.current) return
    totalTapsRef.current += 1

    if (checkAnswer(index, grid)) {
      correctTapsRef.current += 1
      const pts = 10
      setRoundScore(s => s + pts)
      setSelected(prev => new Set(prev).add(index))
    } else {
      setRoundScore(s => Math.max(0, s - 2))
      setFlashRed(index)
      setTimeout(() => setFlashRed(null), 400)
    }
  }

  const totalRoundDuration = Math.round(grid.roundDuration / 1000)
  const timerPercent = (timeLeft / totalRoundDuration) * 100

  return (
    <div className="max-w-sm mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Round {round}/{ROUND_COUNT}</div>
        <div className="text-2xl font-bold tabular-nums">{totalScore}</div>
        <div className={`text-sm font-mono font-bold ${timeLeft <= 5 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {timeLeft}s
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${timeLeft <= 5 ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${timerPercent}%` }}
        />
      </div>

      {/* Rule */}
      <AnimatePresence mode="wait">
        <motion.div
          key={round}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-center py-3 px-4 bg-primary/10 rounded-xl"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Find all</p>
          <p className="text-lg font-semibold">{describeRule(grid.rule)}</p>
        </motion.div>
      </AnimatePresence>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-2">
        {grid.numbers.map((num, i) => (
          <button
            key={`${round}-${i}`}
            onClick={() => handleCellTap(i)}
            className={`
              aspect-square flex items-center justify-center
              rounded-lg text-sm font-bold font-mono
              min-h-[44px] transition-all
              ${selected.has(i)
                ? 'bg-green-500 text-white border-2 border-green-400 scale-95'
                : flashRed === i
                  ? 'bg-destructive text-white border-2 border-destructive'
                  : 'bg-card border-2 border-muted hover:border-primary hover:bg-primary/10'
              }
            `}
          >
            {num}
          </button>
        ))}
      </div>

      {/* Round progress */}
      <div className="text-center text-sm text-muted-foreground">
        {selected.size} / {grid.correctIndices.size} found
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `games/number-hunt/ResultsScreen.tsx`**

```typescript
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import { Trophy, Target, Search, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AuthModal } from '@/components/AuthModal'
import { useAuth } from '@/components/AuthProvider'
import type { GameResult } from '@/types'

interface ResultsScreenProps {
  result: GameResult
  onPlayAgain: () => void
}

interface SavedData {
  isPersonalBest: boolean
  percentile: number | null
  previousBest: number | null
}

export function ResultsScreen({ result, onPlayAgain }: ResultsScreenProps) {
  const { user } = useAuth()
  const [savedData, setSavedData] = useState<SavedData | null>(null)
  const [saving, setSaving] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const hasSaved = useRef(false)

  const saveScore = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'number-hunt',
          configHash: result.configHash,
          score: result.score,
          accuracy: result.accuracy,
          metadata: { duration: 0 },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedData(data)
        if (data.isPersonalBest) {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
        }
      }
    } finally {
      setSaving(false)
    }
  }, [result])

  useEffect(() => {
    if (hasSaved.current) return
    if (!user) return
    hasSaved.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    saveScore()
  }, [user, saveScore])

  const stats = [
    { icon: Trophy, label: 'Score', value: result.score, color: 'text-yellow-500' },
    { icon: Target, label: 'Accuracy', value: `${Math.round(result.accuracy * 100)}%`, color: 'text-blue-500' },
    { icon: Search, label: 'Per min', value: result.problemsPerMinute, color: 'text-green-500' },
  ]

  return (
    <div className="max-w-sm mx-auto space-y-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="text-center"
      >
        <div className="text-7xl font-bold tabular-nums mb-2">{result.score}</div>
        <div className="text-muted-foreground">points across 10 rounds</div>

        {savedData?.isPersonalBest && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-primary font-semibold"
          >
            New personal best!
          </motion.div>
        )}

        {savedData?.percentile != null && (
          <div className="mt-1 text-sm text-muted-foreground">
            Better than {savedData.percentile}% of players
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3 text-center">
              <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
              <div className="text-xl font-bold tabular-nums">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!user && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-3 text-center space-y-2">
            <p className="text-sm font-medium">Log in to save your score and climb the leaderboard.</p>
            <Button size="sm" onClick={() => setAuthOpen(true)}>
              Log In / Sign Up
            </Button>
          </CardContent>
        </Card>
      )}

      {saving && (
        <p className="text-center text-sm text-muted-foreground">Saving score…</p>
      )}

      <Button onClick={onPlayAgain} className="w-full gap-2 min-h-[44px]">
        <RefreshCw className="h-4 w-4" />
        Play Again
      </Button>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  )
}
```

- [ ] **Step 3: Create `app/play/number-hunt/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SiteHeader } from '@/components/SiteHeader'
import { GameScreen } from '@/games/number-hunt/GameScreen'
import { ResultsScreen } from '@/games/number-hunt/ResultsScreen'
import type { GameResult } from '@/types'

type GamePhase = 'playing' | 'results'

export default function NumberHuntPage() {
  const [phase, setPhase] = useState<GamePhase>('playing')
  const [result, setResult] = useState<GameResult | null>(null)

  function handleFinish(gameResult: GameResult) {
    setResult(gameResult)
    setPhase('results')
  }

  function handlePlayAgain() {
    setResult(null)
    setPhase('playing')
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container max-w-2xl mx-auto px-4 py-8">
        {phase !== 'playing' && (
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 mb-6">
              <ArrowLeft className="h-4 w-4" />
              Back to hub
            </Button>
          </Link>
        )}

        {phase === 'playing' && (
          <GameScreen onFinish={handleFinish} />
        )}

        {phase === 'results' && result && (
          <ResultsScreen result={result} onPlayAgain={handlePlayAgain} />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Build and lint**

```bash
npm run build && npm run lint
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add games/number-hunt/GameScreen.tsx games/number-hunt/ResultsScreen.tsx app/play/number-hunt/page.tsx
git commit -m "feat: add Number Hunt game screen, results screen, and page"
```

---

## Task 8: Combined Leaderboard

**Files:**
- Modify: `components/Leaderboard.tsx`
- Modify: `app/leaderboard/page.tsx`

**Interfaces:**
- Consumes: Supabase RPC `get_combined_scores` (must be created in Supabase SQL editor before this task runs)
- Produces: Leaderboard page with 5 mode tabs; `Leaderboard` component handles `mode='combined'`

**Pre-requisite:** Run this SQL in the Supabase SQL editor before this task:

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

- [ ] **Step 1: Replace `components/Leaderboard.tsx`**

```typescript
'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Trophy, Medal } from 'lucide-react'
import type { LeaderboardEntry } from '@/types'

type Timeframe = 'today' | 'alltime'

interface LeaderboardProps {
  mode?: string
}

export function Leaderboard({ mode = 'arithmetic' }: LeaderboardProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('alltime')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const loadEntries = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    if (mode === 'combined') {
      const { data, error } = await supabase.rpc('get_combined_scores', { p_limit: 50 })
      setLoading(false)
      if (error || !data) return
      const ranked: LeaderboardEntry[] = (data as Array<{ username: string | null; total_score: number }>)
        .map((row, idx) => ({
          rank: idx + 1,
          username: row.username ?? null,
          score: Number(row.total_score),
          createdAt: '',
        }))
      setEntries(ranked)
      return
    }

    let query = supabase
      .from('scores')
      .select('score, created_at, user_id, profiles(username)')
      .eq('mode', mode)
      .order('score', { ascending: false })
      .limit(500)

    if (timeframe === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      query = query.gte('created_at', today.toISOString())
    }

    const { data, error } = await query
    setLoading(false)

    if (error || !data) return

    const seen = new Set<string>()
    const deduped = data.filter(row => {
      if (seen.has(row.user_id)) return false
      seen.add(row.user_id)
      return true
    })

    const ranked: LeaderboardEntry[] = deduped.slice(0, 50).map((row, idx) => ({
      rank: idx + 1,
      // @ts-expect-error — Supabase join typing is complex
      username: row.profiles?.username ?? null,
      score: row.score,
      createdAt: row.created_at,
    }))

    setEntries(ranked)
  }, [timeframe, mode])

  useEffect(() => {
    loadEntries() // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadEntries])

  function switchTimeframe(t: Timeframe) {
    startTransition(() => setTimeframe(t))
  }

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />
    if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />
    if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />
    return <span className="text-sm text-muted-foreground tabular-nums">{rank}</span>
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Leaderboard
          </CardTitle>
          {mode !== 'combined' && (
            <div className="flex gap-1">
              {(['today', 'alltime'] as Timeframe[]).map(t => (
                <button
                  key={t}
                  onClick={() => switchTimeframe(t)}
                  className={`
                    px-3 py-1 rounded-lg text-sm font-medium transition-colors min-h-[32px]
                    ${timeframe === t
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }
                  `}
                >
                  {t === 'today' ? 'Today' : 'All Time'}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4">
        {loading || isPending ? (
          <div className="text-center text-muted-foreground py-8">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No scores yet. Be the first!
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => (
              <div
                key={`${entry.rank}-${entry.score}-${entry.createdAt}`}
                className={`flex items-center gap-3 p-2 rounded-lg ${
                  entry.rank <= 3 ? 'bg-muted/50' : ''
                }`}
              >
                <div className="w-8 flex justify-center">
                  {rankIcon(entry.rank)}
                </div>
                <div className="flex-1 font-medium">
                  {entry.username ?? <span className="text-muted-foreground italic">Anonymous</span>}
                </div>
                <Badge variant="secondary" className="tabular-nums font-mono">
                  {entry.score}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Replace `app/leaderboard/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { SiteHeader } from '@/components/SiteHeader'
import { Leaderboard } from '@/components/Leaderboard'

const MODES = [
  { label: 'Arithmetic Sprint', value: 'arithmetic' },
  { label: 'Bubble Burst', value: 'bubble-burst' },
  { label: 'Falling Equations', value: 'falling-equations' },
  { label: 'Number Hunt', value: 'number-hunt' },
  { label: 'All Modes', value: 'combined' },
] as const

type ModeValue = typeof MODES[number]['value']

export default function LeaderboardPage() {
  const [activeMode, setActiveMode] = useState<ModeValue>('arithmetic')

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Leaderboard</h1>

        {/* Mode tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {MODES.map(m => (
            <button
              key={m.value}
              onClick={() => setActiveMode(m.value)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]
                ${activeMode === m.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }
              `}
            >
              {m.label}
            </button>
          ))}
        </div>

        <Leaderboard mode={activeMode} />
      </main>
    </div>
  )
}
```

Note: `app/leaderboard/page.tsx` is now a client component (`'use client'`). This is required for the mode tab state. If the linter or build complains about `metadata` exports from a client page, remove any metadata export from this file.

- [ ] **Step 3: Build and lint**

```bash
npm run build && npm run lint
```

Expected: both pass.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 5: Commit and push**

```bash
git add components/Leaderboard.tsx app/leaderboard/page.tsx
git commit -m "feat: add combined leaderboard with All Modes tab and per-mode tabs"
git push origin main
```

---

## Self-Review Checklist

- [x] Spec coverage: all 3 modes built (Bubble Burst, Falling Equations, Number Hunt); combined leaderboard; homepage updated; shared infrastructure (types, anti-cheat, scores API) updated
- [x] No TBD or TODO placeholders
- [x] Type consistency: `Bubble.spawnDelay` used in `scoreBubbleTap` as `waveStartTime + bubble.spawnDelay`; `FallingBlock.spawnTime` set at spawn time; `HuntGrid.correctIndices` is `Set<number>` throughout
- [x] All engines: `hashConfig` from `lib/config-hash` returns `Promise<string>`; called correctly
- [x] Anti-cheat: `isScorePlausible(mode, duration, score)` — new modes pass `duration=0`, hits `MAX_SCORES[mode][0]`
- [x] `GameResult.duration` widened to `number` — arithmetic still passes `config.duration` (a subtype of number), no breakage
