'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SiteHeader } from '@/components/SiteHeader'
import { GameScreen } from '@/games/number-hunt/GameScreen'
import { ResultsScreen } from '@/games/number-hunt/ResultsScreen'
import type { GameResult } from '@/types'

type GamePhase = 'playing' | 'results'

export default function NumberHuntPage() {
  const [phase, setPhase] = useState<GamePhase>('playing')
  const [result, setResult] = useState<GameResult | null>(null)

  function handleFinish(gameResult: GameResult) {
    setResult(gameResult)
    setPhase('results')
  }

  function handlePlayAgain() {
    setResult(null)
    setPhase('playing')
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container max-w-2xl mx-auto px-4 py-8">
        {phase !== 'playing' && (
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 mb-6">
              <ArrowLeft className="h-4 w-4" />
              Back to hub
            </Button>
          </Link>
        )}

        {phase === 'playing' && (
          <GameScreen onFinish={handleFinish} />
        )}

        {phase === 'results' && result && (
          <ResultsScreen result={result} onPlayAgain={handlePlayAgain} />
        )}
      </main>
    </div>
  )
}
