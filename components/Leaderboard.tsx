'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Trophy, Medal } from 'lucide-react'
import type { LeaderboardEntry } from '@/types'

type Timeframe = 'today' | 'alltime'

interface LeaderboardProps {
  mode?: string
}

export function Leaderboard({ mode = 'arithmetic' }: LeaderboardProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('alltime')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const loadEntries = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('scores')
      .select('score, created_at, profiles(username)')
      .eq('mode', mode)
      .order('score', { ascending: false })
      .limit(50)

    if (timeframe === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      query = query.gte('created_at', today.toISOString())
    }

    const { data, error } = await query
    setLoading(false)

    if (error || !data) return

    const ranked: LeaderboardEntry[] = data.map((row, idx) => ({
      rank: idx + 1,
      // @ts-expect-error — Supabase join typing is complex
      username: row.profiles?.username ?? null,
      score: row.score,
      createdAt: row.created_at,
    }))

    setEntries(ranked)
  }, [timeframe, mode])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEntries()
  }, [loadEntries])

  function switchTimeframe(t: Timeframe) {
    startTransition(() => setTimeframe(t))
  }

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />
    if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />
    if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />
    return <span className="text-sm text-muted-foreground tabular-nums">{rank}</span>
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Leaderboard
          </CardTitle>
          <div className="flex gap-1">
            {(['today', 'alltime'] as Timeframe[]).map(t => (
              <button
                key={t}
                onClick={() => switchTimeframe(t)}
                className={`
                  px-3 py-1 rounded-lg text-sm font-medium transition-colors min-h-[32px]
                  ${timeframe === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }
                `}
              >
                {t === 'today' ? 'Today' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4">
        {loading || isPending ? (
          <div className="text-center text-muted-foreground py-8">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No scores yet. Be the first!
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => (
              <div
                key={`${entry.rank}-${entry.score}-${entry.createdAt}`}
                className={`flex items-center gap-3 p-2 rounded-lg ${
                  entry.rank <= 3 ? 'bg-muted/50' : ''
                }`}
              >
                <div className="w-8 flex justify-center">
                  {rankIcon(entry.rank)}
                </div>
                <div className="flex-1 font-medium">
                  {entry.username ?? <span className="text-muted-foreground italic">Anonymous</span>}
                </div>
                <Badge variant="secondary" className="tabular-nums font-mono">
                  {entry.score}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
