export type GameMode = 'arithmetic' | 'bubble-burst' | 'falling-equations' | 'number-hunt'

export type Operation = 'add' | 'subtract' | 'multiply' | 'divide'

export interface OperationRange {
  min1: number
  max1: number
  min2: number
  max2: number
}

export interface ArithmeticConfig {
  operations: Operation[]
  ranges: Partial<Record<Operation, OperationRange>>
  duration: 30 | 60 | 120
}

export interface Problem {
  operandA: number
  operandB: number
  operation: Operation
  answer: number
  display: string
}

export interface GameResult {
  score: number
  totalAttempts: number
  accuracy: number
  problemsPerMinute: number
  duration: number
  configHash: string
}

export interface LeaderboardEntry {
  rank: number
  username: string | null
  score: number
  createdAt: string
}

export interface Profile {
  id: string
  username: string | null
  avatarUrl: string | null
  subscriptionStatus: string
  xp: number
  streak: number
  lastPlayed: string | null
  createdAt: string
}
