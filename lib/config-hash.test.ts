import { describe, it, expect } from 'vitest'
import { hashArithmeticConfig } from './config-hash'
import type { ArithmeticConfig } from '@/types'

describe('hashArithmeticConfig', () => {
  const baseConfig: ArithmeticConfig = {
    operations: ['add'],
    ranges: { add: { min1: 1, max1: 10, min2: 1, max2: 10 } },
    duration: 60,
  }

  it('returns a 64-character hex string', async () => {
    const hash = await hashArithmeticConfig(baseConfig)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic — same config produces same hash', async () => {
    const h1 = await hashArithmeticConfig(baseConfig)
    const h2 = await hashArithmeticConfig(baseConfig)
    expect(h1).toBe(h2)
  })

  it('is order-independent — operations array sorted before hashing', async () => {
    const config1: ArithmeticConfig = {
      operations: ['add', 'subtract'],
      ranges: {
        add: { min1: 1, max1: 10, min2: 1, max2: 10 },
        subtract: { min1: 1, max1: 10, min2: 1, max2: 10 },
      },
      duration: 60,
    }
    const config2: ArithmeticConfig = {
      ...config1,
      operations: ['subtract', 'add'],
    }
    const h1 = await hashArithmeticConfig(config1)
    const h2 = await hashArithmeticConfig(config2)
    expect(h1).toBe(h2)
  })

  it('different configs produce different hashes', async () => {
    const config30s: ArithmeticConfig = { ...baseConfig, duration: 30 }
    const h1 = await hashArithmeticConfig(baseConfig)
    const h2 = await hashArithmeticConfig(config30s)
    expect(h1).not.toBe(h2)
  })
})
