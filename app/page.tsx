import { Calculator, Circle, Layers, Grid3X3 } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { GameCard } from '@/components/GameCard'

const GAME_MODES = [
  {
    title: 'Arithmetic Sprint',
    description: 'Race against the clock. How many problems can you solve?',
    icon: Calculator,
    href: '/play/arithmetic',
    available: true,
    badge: 'Play Now',
  },
  {
    title: 'Bubble Burst',
    description: 'Tap the correct answer before bubbles float away.',
    icon: Circle,
    href: '/play/bubble-burst',
    available: false,
  },
  {
    title: 'Falling Equations',
    description: 'Type answers before equation blocks hit the floor.',
    icon: Layers,
    href: '/play/falling-equations',
    available: false,
  },
  {
    title: 'Number Hunt',
    description: 'Find all the numbers matching the rule before time runs out.',
    icon: Grid3X3,
    href: '/play/number-hunt',
    available: false,
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Train Your Brain
          </h1>
          <p className="text-lg text-muted-foreground">
            Your brain is about to thank you. Pick a mode.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {GAME_MODES.map(mode => (
            <GameCard key={mode.title} {...mode} />
          ))}
        </div>
      </main>
    </div>
  )
}
