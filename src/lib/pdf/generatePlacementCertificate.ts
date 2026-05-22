import type { jsPDF as JsPDFType } from 'jspdf'

export interface PlacementCertificateData {
  fullName: string
  badge: string
  estimatedLevel: string
  recommendedClass: string
  score: number
  xp: number
  completedAt: string
  certificateRef: string
}

const NAVY: [number, number, number] = [27, 45, 91]
const GOLD: [number, number, number] = [201, 168, 76]
const WHITE: [number, number, number] = [255, 255, 255]
const CREAM: [number, number, number] = [250, 248, 243]
const BORDER: [number, number, number] = [226, 220, 208]
const MUTED: [number, number, number] = [96, 104, 120]

function frDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

async function loadLogoBase64(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.src = '/cambridge_campus_rabat_logo.png'
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth || 200
        canvas.height = image.naturalHeight || 200
        const context = canvas.getContext('2d')
        if (!context) return resolve(null)
        context.drawImage(image, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      }
      image.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function generatePlacementCertificatePdf(data: PlacementCertificateData): Promise<void> {
  const { default: jsPDF } = await import('jspdf')

  const doc: JsPDFType = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const logo = await loadLogoBase64()
  const pageWidth = 297
  const pageHeight = 210

  doc.setFillColor(...CREAM)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(1.2)
  doc.roundedRect(10, 10, pageWidth - 20, pageHeight - 20, 8, 8, 'S')
  doc.setLineWidth(0.35)
  doc.roundedRect(14, 14, pageWidth - 28, pageHeight - 28, 6, 6, 'S')

  doc.setFillColor(...NAVY)
  doc.rect(0, 0, pageWidth, 28, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, 28, pageWidth, 1.5, 'F')

  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 18, 8, 18, 18)
      doc.setGState(new doc.GState({ opacity: 0.06 }))
      doc.addImage(logo, 'PNG', pageWidth / 2 - 42, 58, 84, 84)
      doc.setGState(new doc.GState({ opacity: 1 }))
    } catch {
      // ignore image errors
    }
  }

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('CAMBRIDGE CAMPUS', 42, 15)
  doc.setTextColor(...GOLD)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Practice Makes Perfect', 42, 21)

  doc.setTextColor(...NAVY)
  doc.setFont('times', 'bold')
  doc.setFontSize(28)
  doc.text('Certificate of English Quest Completion', pageWidth / 2, 58, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...MUTED)
  doc.text('This certificate is proudly awarded to', pageWidth / 2, 72, { align: 'center' })

  doc.setFont('times', 'bolditalic')
  doc.setFontSize(30)
  doc.setTextColor(...NAVY)
  doc.text(data.fullName, pageWidth / 2, 92, { align: 'center' })

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.6)
  doc.line(84, 97, pageWidth - 84, 97)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...MUTED)
  doc.text(
    `for successfully completing Cambridge English Quest and unlocking the ${data.badge} badge.`,
    pageWidth / 2,
    110,
    { align: 'center' },
  )

  const statY = 126
  const cardWidth = 58
  const gap = 8
  const totalWidth = cardWidth * 4 + gap * 3
  const startX = (pageWidth - totalWidth) / 2
  const cards = [
    ['Estimated level', data.estimatedLevel],
    ['Recommended class', data.recommendedClass],
    ['Quest score', `${data.score}%`],
    ['XP earned', `${data.xp} XP`],
  ]

  cards.forEach(([label, value], index) => {
    const x = startX + index * (cardWidth + gap)
    doc.setFillColor(...WHITE)
    doc.setDrawColor(...BORDER)
    doc.roundedRect(x, statY, cardWidth, 24, 3, 3, 'FD')
    doc.setFillColor(...GOLD)
    doc.roundedRect(x, statY, cardWidth, 2, 1, 1, 'F')
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(label.toUpperCase(), x + cardWidth / 2, statY + 8, { align: 'center' })
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(value.length > 18 ? 8.5 : 11)
    doc.text(value, x + cardWidth / 2, statY + 16, { align: 'center', maxWidth: cardWidth - 6 })
  })

  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(`Awarded on ${frDate(data.completedAt)}`, 46, 182)
  doc.text(`Certificate ref: ${data.certificateRef}`, 46, 188)

  doc.setDrawColor(...NAVY)
  doc.line(pageWidth - 94, 180, pageWidth - 34, 180)
  doc.setFont('times', 'italic')
  doc.setTextColor(...NAVY)
  doc.setFontSize(18)
  doc.text('Academic Director', pageWidth - 64, 174, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Cambridge Campus', pageWidth - 64, 186, { align: 'center' })

  const safeName = data.fullName.replace(/\s+/g, '_').toLowerCase()
  doc.save(`cambridge_quest_certificate_${safeName}.pdf`)
}
