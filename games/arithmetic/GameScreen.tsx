'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateProblem, checkAnswer } from './engine'
import type { ArithmeticConfig, Problem, GameResult } from '@/types'
import { hashArithmeticConfig } from '@/lib/config-hash'

interface GameScreenProps {
  config: ArithmeticConfig
  onFinish: (result: GameResult) => void
}

export function GameScreen({ config, onFinish }: GameScreenProps) {
  const [timeLeft, setTimeLeft] = useState<number>(config.duration)
  const [problem, setProblem] = useState<Problem>(() => generateProblem(config))
  const [input, setInput] = useState('')
  const [score, setScore] = useState(0)
  const [totalAttempts, setTotalAttempts] = useState(0)
  const [shake, setShake] = useState(false)
  const [problemKey, setProblemKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const startTime = useRef(Date.now())
  const gameOver = useRef(false)

  useEffect(() => { inputRef.current?.focus() }, [])

  const finishGame = useCallback(async (finalScore: number, finalAttempts: number) => {
    if (gameOver.current) return
    gameOver.current = true
    const elapsed = Math.max((Date.now() - startTime.current) / 1000 / 60, 0.001)
    const configHash = await hashArithmeticConfig(config)
    onFinish({
      score: finalScore,
      totalAttempts: finalAttempts,
      accuracy: finalAttempts === 0 ? 0 : finalScore / finalAttempts,
      problemsPerMinute: Math.round(finalScore / elapsed),
      duration: config.duration,
      configHash,
    })
  }, [config, onFinish])

  useEffect(() => {
    if (timeLeft <= 0) return
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(id); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Use refs to capture latest score/attempts for the finish callback
  const scoreRef = useRef(0)
  const attemptsRef = useRef(0)
  scoreRef.current = score
  attemptsRef.current = totalAttempts

  useEffect(() => {
    if (timeLeft === 0) finishGame(scoreRef.current, attemptsRef.current)
  }, [timeLeft, finishGame])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setInput(value)
    if (!value) return
    if (checkAnswer(problem, value)) {
      const newScore = score + 1
      const newAttempts = totalAttempts + 1
      setScore(newScore)
      setTotalAttempts(newAttempts)
      setInput('')
      setProblem(generateProblem(config))
      setProblemKey(k => k + 1)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && input && !checkAnswer(problem, input)) {
      setTotalAttempts(t => t + 1)
      setShake(true)
      setInput('')
      setTimeout(() => {
        setShake(false)
        inputRef.current?.focus()
      }, 400)
    }
  }

  const timePercent = (timeLeft / config.duration) * 100
  const timerColor = timeLeft <= 10 ? 'bg-destructive' : timeLeft <= 20 ? 'bg-yellow-500' : 'bg-primary'

  return (
    <div className="max-w-sm mx-auto flex flex-col items-center gap-8">
      <div className="w-full">
        <div className="flex justify-between text-sm text-muted-foreground mb-1">
          <span>Time</span>
          <span className={`font-mono font-bold text-lg ${timeLeft <= 10 ? 'text-destructive' : ''}`}>
            {timeLeft}s
          </span>
        </div>
        <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${timerColor}`}
            style={{ width: `${timePercent}%` }}
          />
        </div>
      </div>

      <div className="text-center">
        <div className="text-5xl font-bold tabular-nums">{score}</div>
        <div className="text-sm text-muted-foreground">correct</div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={problemKey}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.12 }}
          className="text-5xl font-bold text-center tracking-tight"
        >
          {problem.display} = ?
        </motion.div>
      </AnimatePresence>

      <motion.div
        animate={shake ? { x: [-6, 6, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full"
      >
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          className={`
            w-full text-center text-3xl font-mono font-bold
            bg-muted rounded-2xl border-2 py-4 px-6
            focus:outline-none focus:border-primary transition-colors
            min-h-[64px]
            ${shake ? 'border-destructive' : 'border-transparent'}
          `}
          placeholder="?"
          autoComplete="off"
          autoCorrect="off"
        />
      </motion.div>
    </div>
  )
}
