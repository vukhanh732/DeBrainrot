import type { Operation, OperationRange, Problem, ArithmeticConfig } from '@/types'

const DEFAULT_RANGE: OperationRange = { min1: 1, max1: 12, min2: 1, max2: 12 }

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function buildAddProblem(range: OperationRange): Problem {
  const a = randomInt(range.min1, range.max1)
  const b = randomInt(range.min2, range.max2)
  return { operandA: a, operandB: b, operation: 'add', answer: a + b, display: `${a} + ${b}` }
}

function buildSubtractProblem(range: OperationRange): Problem {
  const a = randomInt(range.min1, range.max1)
  const b = randomInt(range.min2, range.max2)
  // swap so result is always >= 0
  const [big, small] = a >= b ? [a, b] : [b, a]
  return { operandA: big, operandB: small, operation: 'subtract', answer: big - small, display: `${big} − ${small}` }
}

function buildMultiplyProblem(range: OperationRange): Problem {
  const a = randomInt(range.min1, range.max1)
  const b = randomInt(range.min2, range.max2)
  return { operandA: a, operandB: b, operation: 'multiply', answer: a * b, display: `${a} × ${b}` }
}

function buildDivideProblem(range: OperationRange): Problem {
  // Generate divisor and quotient; compute dividend = divisor × quotient
  // This guarantees integer answers with no remainder
  const divisor = randomInt(Math.max(range.min2, 1), range.max2)
  const quotient = randomInt(range.min1, range.max1)
  const dividend = divisor * quotient
  return { operandA: dividend, operandB: divisor, operation: 'divide', answer: quotient, display: `${dividend} ÷ ${divisor}` }
}

const BUILDERS: Record<Operation, (range: OperationRange) => Problem> = {
  add: buildAddProblem,
  subtract: buildSubtractProblem,
  multiply: buildMultiplyProblem,
  divide: buildDivideProblem,
}

export function generateProblem(config: ArithmeticConfig): Problem {
  const op = config.operations[Math.floor(Math.random() * config.operations.length)]
  const range = config.ranges[op] ?? DEFAULT_RANGE
  return BUILDERS[op](range)
}

export function checkAnswer(problem: Problem, input: string): boolean {
  const parsed = parseInt(input, 10)
  return !isNaN(parsed) && parsed === problem.answer
}
