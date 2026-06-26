'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateGrid, checkAnswer, describeRule, ROUND_COUNT, NUMBER_HUNT_CONFIG_HASH } from './engine'
import type { HuntGrid } from './engine'
import type { GameResult } from '@/types'

interface GameScreenProps {
  onFinish: (result: GameResult) => void
}

export function GameScreen({ onFinish }: GameScreenProps) {
  const [round, setRound] = useState(1)
  const [grid, setGrid] = useState<HuntGrid>(() => generateGrid(1))
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [flashRed, setFlashRed] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [roundScore, setRoundScore] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const totalScoreRef = useRef(0)
  const roundRef = useRef(1)
  const correctTapsRef = useRef(0)
  const totalTapsRef = useRef(0)
  const gameOver = useRef(false)
  const advancingRound = useRef(false)

  useEffect(() => { totalScoreRef.current = totalScore }, [totalScore])
  useEffect(() => { roundRef.current = round }, [round])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeLeft(Math.round(grid.roundDuration / 1000))
    setSelected(new Set())
    setRoundScore(0)
    advancingRound.current = false
  }, [grid])

  const finishGame = useCallback(async () => {
    if (gameOver.current) return
    gameOver.current = true
    const configHash = await NUMBER_HUNT_CONFIG_HASH
    onFinish({
      score: totalScoreRef.current,
      totalAttempts: totalTapsRef.current,
      accuracy: totalTapsRef.current === 0 ? 0 : correctTapsRef.current / totalTapsRef.current,
      problemsPerMinute: Math.round(correctTapsRef.current / ((ROUND_COUNT * 12) / 60)),
      duration: 0,
      configHash,
    })
  }, [onFinish])

  const advanceRound = useCallback((currentGrid: HuntGrid, currentSelected: Set<number>, currentTimeLeft: number, currentRoundScore: number) => {
    if (advancingRound.current || gameOver.current) return
    advancingRound.current = true

    const bonus = Math.round(currentTimeLeft * 3)
    const finalRoundScore = currentRoundScore + bonus
    const newTotal = totalScoreRef.current + finalRoundScore
    setTotalScore(newTotal)
    totalScoreRef.current = newTotal

    if (roundRef.current >= ROUND_COUNT) {
      setTimeout(() => finishGame(), 400)
    } else {
      setTimeout(() => {
        const nextRound = roundRef.current + 1
        setRound(nextRound)
        setGrid(generateGrid(nextRound))
      }, 600)
    }
  }, [finishGame])

  // Check if all correct answers are tapped
  useEffect(() => {
    if (selected.size === 0) return
    const allCorrectFound = [...grid.correctIndices].every(i => selected.has(i))
    if (allCorrectFound && !advancingRound.current) {
      advanceRound(grid, selected, timeLeft, roundScore)
    }
  }, [selected, grid, timeLeft, roundScore, advanceRound])

  // Round timer
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id)
          if (!advancingRound.current) advanceRound(grid, selected, 0, roundScore)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [grid, selected, roundScore, advanceRound])

  function handleCellTap(index: number) {
    if (selected.has(index) || flashRed === index || advancingRound.current) return
    totalTapsRef.current += 1

    if (checkAnswer(index, grid)) {
      correctTapsRef.current += 1
      const pts = 10
      setRoundScore(s => s + pts)
      setSelected(prev => new Set(prev).add(index))
    } else {
      setRoundScore(s => Math.max(0, s - 2))
      setFlashRed(index)
      setTimeout(() => setFlashRed(null), 400)
    }
  }

  const totalRoundDuration = Math.round(grid.roundDuration / 1000)
  const timerPercent = (timeLeft / totalRoundDuration) * 100

  return (
    <div className="max-w-sm mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Round {round}/{ROUND_COUNT}</div>
        <div className="text-2xl font-bold tabular-nums">{totalScore}</div>
        <div className={`text-sm font-mono font-bold ${timeLeft <= 5 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {timeLeft}s
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${timeLeft <= 5 ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${timerPercent}%` }}
        />
      </div>

      {/* Rule */}
      <AnimatePresence mode="wait">
        <motion.div
          key={round}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-center py-3 px-4 bg-primary/10 rounded-xl"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Find all</p>
          <p className="text-lg font-semibold">{describeRule(grid.rule)}</p>
        </motion.div>
      </AnimatePresence>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-2">
        {grid.numbers.map((num, i) => (
          <button
            key={`${round}-${i}`}
            onClick={() => handleCellTap(i)}
            className={`
              aspect-square flex items-center justify-center
              rounded-lg text-sm font-bold font-mono
              min-h-[44px] transition-all
              ${selected.has(i)
                ? 'bg-green-500 text-white border-2 border-green-400 scale-95'
                : flashRed === i
                  ? 'bg-destructive text-white border-2 border-destructive'
                  : 'bg-card border-2 border-muted hover:border-primary hover:bg-primary/10'
              }
            `}
          >
            {num}
          </button>
        ))}
      </div>

      {/* Round progress */}
      <div className="text-center text-sm text-muted-foreground">
        {selected.size} / {grid.correctIndices.size} found
      </div>
    </div>
  )
}
