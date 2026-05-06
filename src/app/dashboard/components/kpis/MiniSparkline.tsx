'use client'

export function MiniSparkline({
  data,
  color = '#1B2D5B',
  width = 80,
  height = 28,
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
}) {
  const safeData = data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0]
  const maxValue = Math.max(...safeData, 0)
  const minValue = Math.min(...safeData, 0)
  const range = maxValue - minValue || 1
  const step = safeData.length > 1 ? width / (safeData.length - 1) : width
  const stroke = maxValue === 0 && minValue === 0 ? '#C9C1B3' : color

  const points = safeData.map((value, index) => {
    const x = index * step
    const y = height - (((value - minValue) / range) * (height - 6)) - 3
    return { x, y }
  })

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const lastPoint = points[points.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tendance">
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => (
        <circle
          key={`${point.x}-${point.y}`}
          cx={point.x}
          cy={point.y}
          r={index === points.length - 1 ? 3 : 2}
          fill={index === points.length - 1 ? '#C9A84C' : stroke}
        />
      ))}
      {lastPoint ? <circle cx={lastPoint.x} cy={lastPoint.y} r={3} fill="#C9A84C" /> : null}
    </svg>
  )
}
