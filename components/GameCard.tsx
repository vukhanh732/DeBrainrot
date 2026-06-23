import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { LucideIcon } from 'lucide-react'

interface GameCardProps {
  title: string
  description: string
  icon: LucideIcon
  href: string
  available: boolean
  badge?: string
}

export function GameCard({ title, description, icon: Icon, href, available, badge }: GameCardProps) {
  const inner = (
    <Card className={`
      h-full transition-all duration-200
      ${available
        ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/50'
        : 'opacity-50 cursor-not-allowed'
      }
    `}>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="rounded-xl bg-primary/10 p-3">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          {badge && (
            <Badge variant={available ? 'default' : 'secondary'}>
              {badge}
            </Badge>
          )}
          {!available && !badge && (
            <Badge variant="secondary">Coming Soon</Badge>
          )}
        </div>
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription className="mt-1">{description}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  )

  if (!available) return <div>{inner}</div>

  return <Link href={href} className="block h-full">{inner}</Link>
}
