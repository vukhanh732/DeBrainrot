import { SiteHeader } from '@/components/SiteHeader'
import { Leaderboard } from '@/components/Leaderboard'

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Leaderboard</h1>
        <Leaderboard mode="arithmetic" />
      </main>
    </div>
  )
}
