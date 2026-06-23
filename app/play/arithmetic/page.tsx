'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SiteHeader } from '@/components/SiteHeader'
import { ConfigScreen } from '@/games/arithmetic/ConfigScreen'
import { GameScreen } from '@/games/arithmetic/GameScreen'
import { ResultsScreen } from '@/games/arithmetic/ResultsScreen'
import type { ArithmeticConfig, GameResult } from '@/types'

type GamePhase = 'config' | 'playing' | 'results'

export default function ArithmeticPage() {
  const [phase, setPhase] = useState<GamePhase>('config')
  const [config, setConfig] = useState<ArithmeticConfig | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)

  function handleStart(cfg: ArithmeticConfig) {
    setConfig(cfg)
    setPhase('playing')
  }

  function handleFinish(gameResult: GameResult) {
    setResult(gameResult)
    setPhase('results')
  }

  function handlePlayAgain() {
    setPhase('playing')
  }

  function handleChangeConfig() {
    setPhase('config')
    setResult(null)
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container max-w-6xl mx-auto px-4 py-8">
        {phase !== 'playing' && (
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 mb-6">
              <ArrowLeft className="h-4 w-4" />
              Back to hub
            </Button>
          </Link>
        )}

        {phase === 'config' && <ConfigScreen onStart={handleStart} />}

        {phase === 'playing' && config && (
          <GameScreen config={config} onFinish={handleFinish} />
        )}

        {phase === 'results' && result && config && (
          <ResultsScreen
            result={result}
            onPlayAgain={handlePlayAgain}
            onChangeConfig={handleChangeConfig}
          />
        )}
      </main>
    </div>
  )
}
