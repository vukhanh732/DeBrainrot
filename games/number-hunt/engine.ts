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
