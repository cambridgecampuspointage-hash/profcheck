'use client'

import { useRef, useState, type MouseEvent } from 'react'
import { Award, Sparkles, Star, Trophy } from 'lucide-react'

type AwardBadgeType =
  | 'golden-kitty'
  | 'product-of-the-day'
  | 'product-of-the-month'
  | 'product-of-the-week'

interface AwardBadgeProps {
  type: AwardBadgeType
  place?: number
  link?: string
  label?: string
  subtitle?: string
  brandLabel?: string
  className?: string
  variant?: 'interactive' | 'teacher'
}

const backgrounds: Record<AwardBadgeType, [string, string]> = {
  'golden-kitty': ['#f8efcb', '#ead18a'],
  'product-of-the-day': ['#eff6ff', '#bfdbfe'],
  'product-of-the-month': ['#fff7d6', '#fcd34d'],
  'product-of-the-week': ['#ecfdf5', '#86efac'],
}

const defaultTitles: Record<AwardBadgeType, string> = {
  'golden-kitty': 'Golden Kitty Awards',
  'product-of-the-day': 'Product of the Day',
  'product-of-the-month': 'Product of the Month',
  'product-of-the-week': 'Product of the Week',
}

const accentColors: Record<AwardBadgeType, string> = {
  'golden-kitty': '#9a6b11',
  'product-of-the-day': '#1d4ed8',
  'product-of-the-month': '#b45309',
  'product-of-the-week': '#0f766e',
}

const iconMap: Record<AwardBadgeType, React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>> = {
  'golden-kitty': Trophy,
  'product-of-the-day': Star,
  'product-of-the-month': Award,
  'product-of-the-week': Sparkles,
}

export function AwardBadge({
  type,
  place,
  link,
  label,
  subtitle,
  brandLabel = 'PROFCHECK',
  className = '',
  variant = 'interactive',
}: AwardBadgeProps) {
  const ref = useRef<HTMLAnchorElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const Icon = iconMap[type]
  const title = label || defaultTitles[type]
  const [backgroundStart, backgroundEnd] = backgrounds[type]

  if (variant === 'teacher') {
    return (
      <div
        className={`brand-creative-badge ${typeToTone(type)} ${className}`}
        style={{ minHeight: 128 }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.9rem' }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.72)',
              color: accentColors[type],
              boxShadow: '0 8px 18px rgba(15,23,42,0.08)',
              flexShrink: 0,
            }}
          >
            <Icon size={18} strokeWidth={2.4} color={accentColors[type]} />
          </div>

          <div className={`brand-mini-badge ${typeToTone(type)}`}>
            {brandLabel}
          </div>
        </div>

        <div className="brand-creative-badge-title" style={{ marginTop: '0.85rem' }}>
          {title}
        </div>

        <div className="brand-creative-badge-copy">
          {subtitle || 'Distinction enseignant'}
        </div>
      </div>
    )
  }

  const handleMouseMove = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!ref.current) return

    const rect = ref.current.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 10
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * -10

    setTilt({ x, y })
  }

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 })
  }

  return (
    <a
      ref={ref}
      href={link}
      target={link ? '_blank' : undefined}
      rel={link ? 'noreferrer' : undefined}
      className={`block w-[180px] sm:w-[260px] ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="relative overflow-hidden rounded-2xl border p-3 shadow-sm transition-transform duration-200"
        style={{
          borderColor: 'rgba(90,80,64,0.18)',
          background: `linear-gradient(135deg, ${backgroundStart} 0%, ${backgroundEnd} 100%)`,
          transform: `perspective(700px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.45),transparent_32%,rgba(255,255,255,0.22)_58%,transparent_100%)]" />

        <div className="relative flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/75 shadow-sm"
          >
            <Icon size={18} strokeWidth={2.4} color={accentColors[type]} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[rgba(74,64,50,0.72)]">
              {brandLabel}
            </div>
            <div className="mt-1 text-[13px] font-bold leading-tight text-[#51463a]">
              {title.length > 26 ? `${title.slice(0, 26)}…` : title}
              {place ? ` #${place}` : ''}
            </div>
            <div className="mt-1 text-[10px] leading-tight text-[rgba(74,64,50,0.78)]">
              {(subtitle || 'Distinction enseignant').slice(0, 42)}
            </div>
          </div>
        </div>
      </div>
    </a>
  )
}

function typeToTone(type: AwardBadgeType) {
  if (type === 'golden-kitty') return 'gold'
  if (type === 'product-of-the-week') return 'emerald'
  if (type === 'product-of-the-month') return 'rose'
  return 'navy'
}
