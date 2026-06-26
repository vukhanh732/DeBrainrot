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
    expect(block.lane).toBe(0)
  })

  it('uses level-appropriate fall duration', () => {
    const block5 = generateBlock(5)
    expect(block5.fallDuration).toBe(getFallDuration(5))
  })

  it('assigns lane correctly', () => {
    expect(generateBlock(1, 0).lane).toBe(0)
    expect(generateBlock(1, 1).lane).toBe(1)
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
