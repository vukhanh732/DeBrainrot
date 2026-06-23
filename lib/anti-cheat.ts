import type { GameMode } from '@/types'

// Max plausible correct answers = 3 per second
const MAX_SCORES: Record<GameMode, Record<number, number>> = {
  arithmetic: {
    30: 90,
    60: 180,
    120: 360,
  },
}

export function isScorePlausible(
  mode: GameMode,
  duration: number,
  score: number
): boolean {
  const max = MAX_SCORES[mode]?.[duration]
  if (max === undefined) return false
  return score >= 0 && score <= max
}
