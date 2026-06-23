import { describe, it, expect } from 'vitest'
import { generateProblem, checkAnswer } from './engine'
import type { ArithmeticConfig } from '@/types'

const addConfig: ArithmeticConfig = {
  operations: ['add'],
  ranges: { add: { min1: 1, max1: 10, min2: 1, max2: 10 } },
  duration: 60,
}

const divideConfig: ArithmeticConfig = {
  operations: ['divide'],
  ranges: { divide: { min1: 1, max1: 12, min2: 1, max2: 12 } },
  duration: 60,
}

describe('generateProblem', () => {
  it('generates an addition problem with correct answer', () => {
    for (let i = 0; i < 20; i++) {
      const p = generateProblem(addConfig)
      expect(p.operation).toBe('add')
      expect(p.answer).toBe(p.operandA + p.operandB)
      expect(p.display).toContain('+')
    }
  })

  it('generates operands within configured ranges', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateProblem(addConfig)
      expect(p.operandA).toBeGreaterThanOrEqual(1)
      expect(p.operandA).toBeLessThanOrEqual(10)
      expect(p.operandB).toBeGreaterThanOrEqual(1)
      expect(p.operandB).toBeLessThanOrEqual(10)
    }
  })

  it('generates division problems with integer answers', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateProblem(divideConfig)
      expect(p.answer).toBe(Math.floor(p.answer))
      expect(p.operandA).toBe(p.operandB * p.answer)
    }
  })

  it('subtraction result is always non-negative', () => {
    const subConfig: ArithmeticConfig = {
      operations: ['subtract'],
      ranges: { subtract: { min1: 1, max1: 20, min2: 1, max2: 20 } },
      duration: 60,
    }
    for (let i = 0; i < 50; i++) {
      const p = generateProblem(subConfig)
      expect(p.answer).toBeGreaterThanOrEqual(0)
    }
  })

  it('uses default range when operation range is missing', () => {
    const noRangeConfig: ArithmeticConfig = {
      operations: ['add'],
      ranges: {},
      duration: 60,
    }
    expect(() => generateProblem(noRangeConfig)).not.toThrow()
  })
})

describe('checkAnswer', () => {
  it('returns true for correct string answer', () => {
    const p = { operandA: 3, operandB: 4, operation: 'add' as const, answer: 7, display: '3 + 4' }
    expect(checkAnswer(p, '7')).toBe(true)
  })

  it('returns false for wrong answer', () => {
    const p = { operandA: 3, operandB: 4, operation: 'add' as const, answer: 7, display: '3 + 4' }
    expect(checkAnswer(p, '8')).toBe(false)
  })

  it('returns false for non-numeric input', () => {
    const p = { operandA: 3, operandB: 4, operation: 'add' as const, answer: 7, display: '3 + 4' }
    expect(checkAnswer(p, 'abc')).toBe(false)
  })

  it('returns false for empty string', () => {
    const p = { operandA: 3, operandB: 4, operation: 'add' as const, answer: 7, display: '3 + 4' }
    expect(checkAnswer(p, '')).toBe(false)
  })
})
