'use client'

import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import { Trophy, Target, Zap, RefreshCw, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AuthModal } from '@/components/AuthModal'
import { useAuth } from '@/components/AuthProvider'
import type { GameResult } from '@/types'

interface ResultsScreenProps {
  result: GameResult
  onPlayAgain: () => void
  onChangeConfig: () => void
}

interface SavedData {
  isPersonalBest: boolean
  percentile: number | null
  previousBest: number | null
}

export function ResultsScreen({ result, onPlayAgain, onChangeConfig }: ResultsScreenProps) {
  const { user } = useAuth()
  const [savedData, setSavedData] = useState<SavedData | null>(null)
  const [saving, setSaving] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const hasSaved = useRef(false)

  useEffect(() => {
    if (hasSaved.current) return
    hasSaved.current = true
    if (!user) return
    saveScore()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveScore() {
    setSaving(true)
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'arithmetic',
          configHash: result.configHash,
          score: result.score,
          accuracy: result.accuracy,
          metadata: {
            duration: result.duration,
            totalAttempts: result.totalAttempts,
            problemsPerMinute: result.problemsPerMinute,
          },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSavedData(data)
        if (data.isPersonalBest) {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const stats = [
    { icon: Trophy, label: 'Score', value: result.score, color: 'text-yellow-500' },
    { icon: Target, label: 'Accuracy', value: `${Math.round(result.accuracy * 100)}%`, color: 'text-blue-500' },
    { icon: Zap, label: 'Per min', value: result.problemsPerMinute, color: 'text-green-500' },
  ]

  return (
    <div className="max-w-sm mx-auto space-y-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="text-center"
      >
        <div className="text-7xl font-bold tabular-nums mb-2">{result.score}</div>
        <div className="text-muted-foreground">correct in {result.duration} seconds</div>

        {savedData?.isPersonalBest && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-primary font-semibold"
          >
            New personal best!
          </motion.div>
        )}

        {savedData?.percentile != null && (
          <div className="mt-1 text-sm text-muted-foreground">
            Faster than {savedData.percentile}% of players
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3 text-center">
              <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
              <div className="text-xl font-bold tabular-nums">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!user && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-3 text-center space-y-2">
            <p className="text-sm font-medium">Log in to save your score and climb the leaderboard.</p>
            <Button size="sm" onClick={() => setAuthOpen(true)}>
              Log In / Sign Up
            </Button>
          </CardContent>
        </Card>
      )}

      {saving && (
        <p className="text-center text-sm text-muted-foreground">Saving score…</p>
      )}

      <div className="flex gap-3">
        <Button onClick={onChangeConfig} variant="outline" className="flex-1 gap-2 min-h-[44px]">
          <Settings className="h-4 w-4" />
          Change Config
        </Button>
        <Button onClick={onPlayAgain} className="flex-1 gap-2 min-h-[44px]">
          <RefreshCw className="h-4 w-4" />
          Play Again
        </Button>
      </div>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  )
}
