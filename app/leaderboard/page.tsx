'use client'

import { useState } from 'react'
import { SiteHeader } from '@/components/SiteHeader'
import { Leaderboard } from '@/components/Leaderboard'

const MODES = [
  { label: 'Arithmetic Sprint', value: 'arithmetic' },
  { label: 'Bubble Burst', value: 'bubble-burst' },
  { label: 'Falling Equations', value: 'falling-equations' },
  { label: 'Number Hunt', value: 'number-hunt' },
  { label: 'All Modes', value: 'combined' },
] as const

type ModeValue = typeof MODES[number]['value']

export default function LeaderboardPage() {
  const [activeMode, setActiveMode] = useState<ModeValue>('arithmetic')

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Leaderboard</h1>

        {/* Mode tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {MODES.map(m => (
            <button
              key={m.value}
              onClick={() => setActiveMode(m.value)}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-all min-h-[44px]
                ${activeMode === m.value
                  ? m.value === 'combined'
                    ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md'
                    : 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }
              `}
            >
              {m.label}
            </button>
          ))}
        </div>

        <Leaderboard mode={activeMode} />
      </main>
    </div>
  )
}
