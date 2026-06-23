import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isScorePlausible } from '@/lib/anti-cheat'

interface ScorePayload {
  mode: string
  configHash: string
  score: number
  accuracy: number
  metadata: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ScorePayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { mode, configHash, score, accuracy, metadata } = body

  if (typeof mode !== 'string' || !mode) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }
  if (typeof configHash !== 'string' || !/^[a-f0-9]{64}$/.test(configHash)) {
    return NextResponse.json({ error: 'Invalid configHash' }, { status: 400 })
  }
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
  }
  if (typeof accuracy !== 'number' || accuracy < 0 || accuracy > 1) {
    return NextResponse.json({ error: 'Invalid accuracy' }, { status: 400 })
  }

  const duration = typeof metadata?.duration === 'number' ? metadata.duration : 0
  if (mode === 'arithmetic' && !isScorePlausible('arithmetic', duration, score)) {
    return NextResponse.json({ error: 'Score rejected: implausible result' }, { status: 400 })
  }

  const { data: existingBest } = await supabase
    .from('scores')
    .select('score')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .eq('config_hash', configHash)
    .order('score', { ascending: false })
    .limit(1)
    .single()

  const previousBest = existingBest?.score ?? null
  const isPersonalBest = previousBest === null || score > previousBest

  const { error: insertError } = await supabase.from('scores').insert({
    user_id: user.id,
    mode,
    config_hash: configHash,
    score,
    accuracy,
    metadata,
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const [{ count: total }, { count: below }] = await Promise.all([
    supabase
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('mode', mode)
      .eq('config_hash', configHash),
    supabase
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('mode', mode)
      .eq('config_hash', configHash)
      .lt('score', score),
  ])

  const percentile = total && total > 0
    ? Math.round(((below ?? 0) / total) * 100)
    : null

  return NextResponse.json({ isPersonalBest, previousBest, percentile })
}
