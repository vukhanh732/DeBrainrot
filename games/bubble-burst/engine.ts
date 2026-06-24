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
