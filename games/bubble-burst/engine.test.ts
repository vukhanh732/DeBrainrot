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
