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
