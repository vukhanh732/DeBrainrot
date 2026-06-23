import { describe, it, expect } from 'vitest'
import { isScorePlausible } from './anti-cheat'

describe('isScorePlausible', () => {
  it('accepts score at the max for 30s arithmetic', () => {
    expect(isScorePlausible('arithmetic', 30, 90)).toBe(true)
  })

  it('accepts score at the max for 60s arithmetic', () => {
    expect(isScorePlausible('arithmetic', 60, 180)).toBe(true)
  })

  it('accepts score at the max for 120s arithmetic', () => {
    expect(isScorePlausible('arithmetic', 120, 360)).toBe(true)
  })

  it('rejects score above max for 30s arithmetic', () => {
    expect(isScorePlausible('arithmetic', 30, 91)).toBe(false)
  })

  it('rejects score above max for 60s arithmetic', () => {
    expect(isScorePlausible('arithmetic', 60, 500)).toBe(false)
  })

  it('rejects unknown duration', () => {
    expect(isScorePlausible('arithmetic', 45, 100)).toBe(false)
  })

  it('accepts zero score', () => {
    expect(isScorePlausible('arithmetic', 30, 0)).toBe(true)
  })
})
