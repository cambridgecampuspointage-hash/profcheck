'use client'

import type React from 'react'

import { useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { Map, MapPin } from 'lucide-react'

interface LocationMapProps {
  location?: string
  coordinates?: string
  className?: string
  compact?: boolean
}

export function LocationMap({
  location = 'Rabat, Maroc',
  coordinates = '34.0209° N, 6.8416° W',
  className,
  compact = false,
}: LocationMapProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const rotateX = useTransform(mouseY, [-50, 50], [8, -8])
  const rotateY = useTransform(mouseX, [-50, 50], [-8, 8])

  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 30 })
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 30 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    mouseX.set(e.clientX - centerX)
    mouseY.set(e.clientY - centerY)
  }

  const handleMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
    setIsHovered(false)
  }

  return (
    <motion.div
      ref={containerRef}
      className={`relative select-none ${className ?? ''}`}
      style={{ perspective: 1000 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className={`${compact ? 'absolute left-0 top-0 z-30' : 'relative'} overflow-hidden rounded-3xl border shadow-sm`}
        style={{
          borderColor: 'var(--brand-border)',
          background:
            'linear-gradient(145deg, rgba(255,253,248,0.96) 0%, rgba(250,248,243,0.98) 100%)',
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformStyle: 'preserve-3d',
        }}
        animate={{
          width: isExpanded ? 360 : compact ? 46 : 240,
          height: isExpanded ? 280 : compact ? 46 : 148,
        }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 35,
        }}
        onClick={() => setIsExpanded((value) => !value)}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at top right, rgba(99,102,241,0.08), transparent 30%), radial-gradient(circle at bottom left, rgba(201,168,76,0.12), transparent 30%)',
          }}
        />

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
            >
              <div className="absolute inset-0 bg-[rgba(255,255,255,0.55)]" />

              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                <motion.line
                  x1="0%"
                  x2="100%"
                  y1="35%"
                  y2="35%"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.15 }}
                  stroke="rgba(27,45,91,0.20)"
                  strokeWidth="4"
                />
                <motion.line
                  x1="0%"
                  x2="100%"
                  y1="65%"
                  y2="65%"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.25 }}
                  stroke="rgba(27,45,91,0.20)"
                  strokeWidth="4"
                />
                <motion.line
                  x1="30%"
                  x2="30%"
                  y1="0%"
                  y2="100%"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: 0.35 }}
                  stroke="rgba(27,45,91,0.16)"
                  strokeWidth="3"
                />
                <motion.line
                  x1="70%"
                  x2="70%"
                  y1="0%"
                  y2="100%"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: 0.45 }}
                  stroke="rgba(27,45,91,0.16)"
                  strokeWidth="3"
                />

                {[20, 50, 80].map((y, i) => (
                  <motion.line
                    key={`h-${y}`}
                    x1="0%"
                    x2="100%"
                    y1={`${y}%`}
                    y2={`${y}%`}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.55 + i * 0.08 }}
                    stroke="rgba(138,128,112,0.18)"
                    strokeWidth="1.5"
                  />
                ))}
                {[15, 45, 55, 85].map((x, i) => (
                  <motion.line
                    key={`v-${x}`}
                    x1={`${x}%`}
                    x2={`${x}%`}
                    y1="0%"
                    y2="100%"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.62 + i * 0.08 }}
                    stroke="rgba(138,128,112,0.18)"
                    strokeWidth="1.5"
                  />
                ))}
              </svg>

              <motion.div
                className="absolute left-[10%] top-[40%] h-[20%] w-[15%] rounded-sm border"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.45 }}
                style={{ background: 'rgba(49,69,125,0.14)', borderColor: 'rgba(49,69,125,0.10)' }}
              />
              <motion.div
                className="absolute left-[35%] top-[15%] h-[15%] w-[12%] rounded-sm border"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.52 }}
                style={{ background: 'rgba(49,69,125,0.12)', borderColor: 'rgba(49,69,125,0.08)' }}
              />
              <motion.div
                className="absolute left-[75%] top-[70%] h-[18%] w-[18%] rounded-sm border"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.6 }}
                style={{ background: 'rgba(49,69,125,0.14)', borderColor: 'rgba(49,69,125,0.08)' }}
              />
              <motion.div
                className="absolute right-[10%] top-[20%] h-[25%] w-[10%] rounded-sm border"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.48 }}
                style={{ background: 'rgba(49,69,125,0.10)', borderColor: 'rgba(49,69,125,0.08)' }}
              />

              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                initial={{ scale: 0, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.25 }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg"
                  style={{
                    background: 'linear-gradient(180deg, #34d399 0%, #10b981 100%)',
                    boxShadow: '0 0 18px rgba(52, 211, 153, 0.35)',
                  }}
                >
                  <MapPin size={20} color="#fffdf8" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {!compact || isExpanded ? (
          <motion.div
            className="absolute inset-0 opacity-[0.05]"
            animate={{ opacity: isExpanded ? 0 : 0.05 }}
            transition={{ duration: 0.25 }}
          >
            <svg className="absolute inset-0 h-full w-full">
              <defs>
                <pattern id="location-map-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path
                    d="M 20 0 L 0 0 0 20"
                    fill="none"
                    stroke="rgba(27,45,91,0.45)"
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#location-map-grid)" />
            </svg>
          </motion.div>
        ) : null}

        {compact && !isExpanded ? (
          <div className="relative z-10 flex h-full w-full items-center justify-center">
            <motion.div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.82)' }}
              animate={{
                scale: isHovered ? 1.06 : 1,
                filter: isHovered
                  ? 'drop-shadow(0 0 8px rgba(99,102,241,0.35))'
                  : 'drop-shadow(0 0 4px rgba(99,102,241,0.18))',
              }}
              transition={{ duration: 0.2 }}
            >
              <Map size={18} color="#6366f1" />
            </motion.div>
          </div>
        ) : (
          <div className="relative z-10 flex h-full flex-col justify-between p-5">
            <div className="flex items-start justify-between">
              <motion.div
                animate={{
                  filter: isHovered
                    ? 'drop-shadow(0 0 8px rgba(99,102,241,0.35))'
                    : 'drop-shadow(0 0 4px rgba(99,102,241,0.18))',
                }}
                transition={{ duration: 0.25 }}
              >
                <Map size={18} color="#6366f1" />
              </motion.div>

              <motion.div
                className="flex items-center gap-1.5 rounded-full px-2 py-1"
                style={{ background: 'rgba(27,45,91,0.05)' }}
                animate={{
                  scale: isHovered ? 1.05 : 1,
                  backgroundColor: isHovered ? 'rgba(27,45,91,0.08)' : 'rgba(27,45,91,0.05)',
                }}
                transition={{ duration: 0.2 }}
              >
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-muted)]">
                  GPS
                </span>
              </motion.div>
            </div>

            <div className="space-y-1">
              <motion.h3
                className="text-sm font-semibold tracking-tight text-[var(--brand-navy)]"
                animate={{ x: isHovered ? 4 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                {location}
              </motion.h3>

              <AnimatePresence>
                {isExpanded && (
                  <motion.p
                    className="text-xs font-mono text-[var(--brand-muted)]"
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    {coordinates}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.div
                className="h-px bg-gradient-to-r from-emerald-500/50 via-indigo-400/30 to-transparent"
                initial={{ scaleX: 0, originX: 0 }}
                animate={{ scaleX: isHovered || isExpanded ? 1 : 0.3 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}
      </motion.div>

      {compact ? null : (
        <motion.p
          className="absolute -bottom-6 left-1/2 whitespace-nowrap text-[10px] text-[var(--brand-muted)]"
          style={{ x: '-50%' }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: isHovered && !isExpanded ? 1 : 0,
            y: isHovered ? 0 : 4,
          }}
          transition={{ duration: 0.2 }}
        >
          Cliquer pour agrandir
        </motion.p>
      )}
    </motion.div>
  )
}
