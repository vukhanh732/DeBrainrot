import { createClient } from '@/lib/supabase/server'

export async function computePercentile(
  mode: string,
  configHash: string,
  score: number
): Promise<number | null> {
  const supabase = await createClient()

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

  if (!total || total === 0) return null
  return Math.round(((below ?? 0) / total) * 100)
}
