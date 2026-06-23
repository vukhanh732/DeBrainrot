import type { ArithmeticConfig } from '@/types'

export async function hashArithmeticConfig(config: ArithmeticConfig): Promise<string> {
  const sortedOps = [...config.operations].sort()
  const sortedRanges = Object.fromEntries(
    sortedOps.map(op => [op, config.ranges[op]])
  )

  const canonical = JSON.stringify({
    mode: 'arithmetic',
    operations: sortedOps,
    ranges: sortedRanges,
    duration: config.duration,
  })

  const buffer = new TextEncoder().encode(canonical)
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
