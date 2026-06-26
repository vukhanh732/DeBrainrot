'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateBlock, getLevel, getEquationCount, scoreBlockAnswer, FALLING_EQUATIONS_CONFIG_HASH } from './engine'
import type { FallingBlock } from './engine'
import type { GameResult } from '@/types'

interface GameScreenProps {
  onFinish: (result: GameResult) => void
}

const STARTING_LIVES = 3

export function GameScreen({ onFinish }: GameScreenProps) {
  const [blocks, setBlocks] = useState<FallingBlock[]>([])
  const [lives, setLives] = useState(STARTING_LIVES)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [input, setInput] = useState('')
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scoreRef = useRef(0)
  const correctRef = useRef(0)
  const totalAttemptsRef = useRef(0)
  const livesRef = useRef(STARTING_LIVES)
  const gameOver = useRef(false)
  const gameStartTime = useRef<number>(0)

  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { correctRef.current = correctCount }, [correctCount])
  useEffect(() => { livesRef.current = lives }, [lives])

  const finishGame = useCallback(async () => {
    if (gameOver.current) return
    gameOver.current = true
    const configHash = await FALLING_EQUATIONS_CONFIG_HASH
    const elapsedMin = (Date.now() - gameStartTime.current) / 1000 / 60
    onFinish({
      score: scoreRef.current,
      totalAttempts: totalAttemptsRef.current,
      accuracy: totalAttemptsRef.current === 0 ? 0 : correctRef.current / totalAttemptsRef.current,
      problemsPerMinute: Math.round(correctRef.current / Math.max(elapsedMin, 0.001)),
      duration: 0,
      configHash,
    })
  }, [onFinish])

  // Spawn blocks based on level
  const spawnBlock = useCallback(() => {
    const level = getLevel(correctRef.current)
    setBlocks(prev => {
      const count = getEquationCount(level)
      if (prev.length >= count) return prev
      return [...prev, generateBlock(level)]
    })
  }, [])

  useEffect(() => {
    gameStartTime.current = Date.now()
    spawnBlock()
    inputRef.current?.focus()
  }, [spawnBlock])

  // Set up floor-hit detection per block
  useEffect(() => {
    if (blocks.length === 0) return
    const timeouts: ReturnType<typeof setTimeout>[] = []
    blocks.forEach(block => {
      const elapsed = Date.now() - block.spawnTime
      const remaining = block.fallDuration - elapsed
      if (remaining > 0) {
        const t = setTimeout(() => {
          if (gameOver.current) return
          setBlocks(prev => prev.filter(b => b.id !== block.id))
          setLives(l => {
            const next = l - 1
            if (next <= 0) finishGame()
            return next
          })
          spawnBlock()
        }, remaining)
        timeouts.push(t)
      }
    })
    return () => timeouts.forEach(clearTimeout)
  }, [blocks, finishGame, spawnBlock])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !input) return

    totalAttemptsRef.current += 1
    const activeBlock = blocks[0]
    if (!activeBlock) return

    const parsed = parseInt(input, 10)
    if (!isNaN(parsed) && parsed === activeBlock.problem.answer) {
      const pts = scoreBlockAnswer(activeBlock, Date.now())
      setScore(s => s + pts)
      setCorrectCount(c => c + 1)
      setInput('')
      setBlocks(prev => prev.filter(b => b.id !== activeBlock.id))
      spawnBlock()
    } else {
      setShake(true)
      setInput('')
      setTimeout(() => {
        setShake(false)
        inputRef.current?.focus()
      }, 350)
    }
  }

  const level = getLevel(correctCount)

  return (
    <div className="max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-muted-foreground">Level {level}</div>
        <div className="text-3xl font-bold tabular-nums">{score}</div>
        <div className="flex gap-1">
          {Array.from({ length: STARTING_LIVES }).map((_, i) => (
            <span key={i} className={`text-xl ${i < lives ? 'text-red-500' : 'text-muted'}`}>
              ♥
            </span>
          ))}
        </div>
      </div>

      {/* Fall arena */}
      <div
        className="relative bg-muted/20 rounded-2xl border border-muted overflow-hidden mb-6"
        style={{ height: 340 }}
      >
        <AnimatePresence>
          {blocks.map(block => (
              <motion.div
                key={block.id}
                initial={{ y: '0%' }}
                animate={{ y: '82%' }}
                transition={{ duration: block.fallDuration / 1000, ease: 'linear' }}
                className="absolute left-1/2 -translate-x-1/2 bg-card border-2 border-primary rounded-xl px-6 py-3 text-2xl font-bold text-center shadow-md"
                style={{ top: 0 }}
              >
                {block.problem.display} = ?
              </motion.div>
          ))}
        </AnimatePresence>

        {/* Floor indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-destructive/50 rounded" />
      </div>

      {/* Input */}
      <motion.input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        animate={shake ? { x: [-6, 6, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.3 }}
        className={`
          w-full text-center text-3xl font-mono font-bold
          bg-muted rounded-2xl border-2 py-4 px-6
          focus:outline-none focus:border-primary transition-colors
          min-h-[64px]
          ${shake ? 'border-destructive' : 'border-transparent'}
        `}
        placeholder="answer + Enter"
        autoComplete="off"
      />
    </div>
  )
}
