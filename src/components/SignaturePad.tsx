'use client'

import { useEffect, useRef, useState } from 'react'

type SignaturePadProps = {
  onChange: (value: string, isEmpty: boolean) => void
}

export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const hasSignatureRef = useRef(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ratio = window.devicePixelRatio || 1
    const width = canvas.offsetWidth || 320
    const height = canvas.offsetHeight || 180
    canvas.width = width * ratio
    canvas.height = height * ratio

    const context = canvas.getContext('2d')
    if (!context) return

    context.scale(ratio, ratio)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = 2.4
    context.strokeStyle = '#1b2d5b'
    context.fillStyle = '#fffdf8'
    context.fillRect(0, 0, width, height)
  }, [])

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  const emit = (currentHasSignature = hasSignatureRef.current) => {
    const canvas = canvasRef.current
    if (!canvas) return
    onChange(currentHasSignature ? canvas.toDataURL('image/png') : '', !currentHasSignature)
  }

  useEffect(() => {
    emit(hasSignature)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSignature])

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    const point = pointFromEvent(event)
    if (!canvas || !context || !point) return

    drawingRef.current = true
    canvas.setPointerCapture(event.pointerId)
    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return

    const context = canvasRef.current?.getContext('2d')
    const point = pointFromEvent(event)
    if (!context || !point) return

    context.lineTo(point.x, point.y)
    context.stroke()
    if (!hasSignatureRef.current) {
      hasSignatureRef.current = true
      setHasSignature(true)
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    canvasRef.current?.releasePointerCapture(event.pointerId)
    emit()
  }

  const clear = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#fffdf8'
    context.fillRect(0, 0, canvas.width, canvas.height)
    hasSignatureRef.current = false
    setHasSignature(false)
    onChange('', true)
  }

  return (
    <div>
      <div
        style={{
          border: '1px solid var(--brand-border)',
          borderRadius: 18,
          overflow: 'hidden',
          background: '#fffdf8',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: 180, display: 'block', touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--brand-muted)', fontSize: '0.82rem' }}>
          Signez ici avant de commencer le cours.
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={clear}>
          Effacer la signature
        </button>
      </div>
    </div>
  )
}
