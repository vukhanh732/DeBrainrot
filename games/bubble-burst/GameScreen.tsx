'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateWave, scoreBubbleTap, WAVE_COUNT, WAVE_DURATION, BUBBLE_BURST_CONFIG_HASH } from './engine'
import type { Wave, Bubble } from './engine'
import type { GameResult } from '@/types'

interface GameScreenProps {
  onFinish: (result: GameResult) => void
}

export function GameScreen({ onFinish }: GameScreenProps) {
  const [waveNumber, setWaveNumber] = useState(1)
  const [wave, setWave] = useState<Wave>(() => generateWave(1))
  const [activeBubbles, setActiveBubbles] = useState<Bubble[]>([])
  const [score, setScore] = useState(0)
  const [waveTimeLeft, setWaveTimeLeft] = useState(WAVE_DURATION / 1000)
  const [burstIds, setBurstIds] = useState<Set<string>>(new Set())
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set())
  const waveStartTime = useRef<number>(0)
  const scoreRef = useRef(0)
  const waveRef = useRef<Wave>(wave)
  const gameOver = useRef(false)
  const totalTapsRef = useRef(0)
  const correctTapsRef = useRef(0)

  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { waveRef.current = wave }, [wave])

  // Spawn bubbles with delays
  useEffect(() => {
    waveStartTime.current = Date.now()
    const timeouts: ReturnType<typeof setTimeout>[] = []
    wave.bubbles.forEach(bubble => {
      const t = setTimeout(() => {
        setActiveBubbles(prev => [...prev, bubble])
      }, bubble.spawnDelay)
      timeouts.push(t)
    })
    return () => timeouts.forEach(clearTimeout)
  }, [wave])

  // Remove bubbles that float off screen
  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = []
    activeBubbles.forEach(bubble => {
      const elapsed = Date.now() - waveStartTime.current - bubble.spawnDelay
      const remaining = bubble.floatDuration - elapsed
      if (remaining > 0) {
        const t = setTimeout(() => {
          setActiveBubbles(prev => prev.filter(b => b.id !== bubble.id))
        }, remaining)
        timeouts.push(t)
      }
    })
    return () => timeouts.forEach(clearTimeout)
  }, [activeBubbles])

  // Wave timer
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWaveTimeLeft(WAVE_DURATION / 1000)
    const id = setInterval(() => {
      setWaveTimeLeft(t => {
        if (t <= 1) { clearInterval(id); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [waveNumber])

  const finishGame = useCallback(async () => {
    if (gameOver.current) return
    gameOver.current = true
    const configHash = await BUBBLE_BURST_CONFIG_HASH
    onFinish({
      score: scoreRef.current,
      totalAttempts: totalTapsRef.current,
      accuracy: totalTapsRef.current === 0 ? 0 : correctTapsRef.current / totalTapsRef.current,
      problemsPerMinute: Math.round(correctTapsRef.current / ((WAVE_COUNT * WAVE_DURATION) / 1000 / 60)),
      duration: 0,
      configHash,
    })
  }, [onFinish])

  // Advance wave or finish game
  useEffect(() => {
    if (waveTimeLeft !== 0) return
    if (waveNumber >= WAVE_COUNT) {
      finishGame()
    } else {
      const nextWave = waveNumber + 1
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWaveNumber(nextWave)
      setWave(generateWave(nextWave))
      setActiveBubbles([])
      setBurstIds(new Set())
      setErrorIds(new Set())
    }
  }, [waveTimeLeft, waveNumber, finishGame])

  function handleBubbleTap(bubble: Bubble) {
    if (burstIds.has(bubble.id) || errorIds.has(bubble.id)) return
    totalTapsRef.current += 1

    if (bubble.isCorrect) {
      correctTapsRef.current += 1
      // eslint-disable-next-line react-hooks/purity
      const pts = scoreBubbleTap(bubble, Date.now(), waveStartTime.current)
      setScore(s => s + pts)
      setBurstIds(prev => new Set(prev).add(bubble.id))
      setTimeout(() => {
        setActiveBubbles(prev => prev.filter(b => b.id !== bubble.id))
      }, 300)
    } else {
      setErrorIds(prev => new Set(prev).add(bubble.id))
      setTimeout(() => {
        setActiveBubbles(prev => prev.filter(b => b.id !== bubble.id))
        setErrorIds(prev => { const s = new Set(prev); s.delete(bubble.id); return s })
      }, 400)
    }
  }

  return (
    <div className="relative w-full max-w-lg mx-auto" style={{ height: '70vh', minHeight: 500 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">Wave {waveNumber}/{WAVE_COUNT}</div>
        <div className="text-3xl font-bold tabular-nums">{score}</div>
        <div className={`text-sm font-mono font-bold ${waveTimeLeft <= 5 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {waveTimeLeft}s
        </div>
      </div>

      {/* Problem */}
      <div className="text-center text-4xl font-bold mb-2 tracking-tight">
        {wave.problem.display} = ?
      </div>

      {/* Bubble field */}
      <div className="relative flex-1" style={{ height: 'calc(100% - 120px)' }}>
        <AnimatePresence>
          {activeBubbles.map(bubble => (
            <motion.button
              key={bubble.id}
              initial={{ y: '100%', opacity: 1 }}
              animate={{
                y: '-120%',
                opacity: errorIds.has(bubble.id) ? 0 : 1,
              }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: bubble.floatDuration / 1000, ease: 'linear' }}
              onClick={() => handleBubbleTap(bubble)}
              className={`
                absolute flex items-center justify-center
                w-16 h-16 rounded-full text-xl font-bold
                min-h-[64px] min-w-[64px]
                border-2 transition-colors
                ${burstIds.has(bubble.id)
                  ? 'bg-green-500 border-green-400 text-white scale-125'
                  : errorIds.has(bubble.id)
                    ? 'bg-destructive border-destructive text-white'
                    : 'bg-card border-primary text-foreground hover:bg-primary hover:text-primary-foreground'
                }
              `}
              style={{ left: `${bubble.x}%`, transform: 'translateX(-50%)' }}
            >
              {bubble.value}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
