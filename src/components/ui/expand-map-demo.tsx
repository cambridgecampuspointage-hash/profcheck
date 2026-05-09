'use client'

import { LocationMap } from '@/components/ui/expand-map'

export default function ExpandMapDemo() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center">
      <div className="relative z-10 flex flex-col items-center gap-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--brand-muted)]">
          Current Location
        </p>
        <LocationMap location="San Francisco, CA" coordinates="37.7749° N, 122.4194° W" />
      </div>
    </main>
  )
}
