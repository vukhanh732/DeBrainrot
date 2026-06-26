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
    expect(grid.correctIndices.size).toBeLessThanOrEqual(20)
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
