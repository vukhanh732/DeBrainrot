'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Brain, Trophy, LogIn, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { AuthModal } from '@/components/AuthModal'
import { useAuth } from '@/components/AuthProvider'
import { createClient } from '@/lib/supabase/client'

export function SiteHeader() {
  const { user } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between max-w-6xl mx-auto px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Brain className="h-6 w-6 text-primary" />
          DeBrainRot
        </Link>

        <nav className="flex items-center gap-2">
          <Link href="/leaderboard">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Leaderboard</span>
            </Button>
          </Link>

          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline truncate max-w-[100px]">
                  {user.email?.split('@')[0]}
                </span>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setAuthOpen(true)} className="gap-1.5">
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
          )}
        </nav>
      </div>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </header>
  )
}
