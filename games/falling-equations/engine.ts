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
