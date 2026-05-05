import type { jsPDF as JsPDFType } from 'jspdf'

export interface TeacherAttendanceRow {
  date: string
  start_time: string
  end_time: string
  duration_minutes: number
  room?: string
  subject?: string
  status?: 'validé' | 'en attente' | 'absent'
}

export interface TeacherReportData {
  teacher_name: string
  teacher_email?: string
  teacher_id?: string
  period_from: string
  period_to: string
  hourly_rate: number
  total_sessions: number
  total_hours: number
  estimated_payment: number
  sessions: TeacherAttendanceRow[]
}

const NAVY = [27, 45, 91] as const
const GOLD = [201, 168, 76] as const
const WHITE = [255, 255, 255] as const
const CREAM = [250, 248, 243] as const
const GRAY = [96, 104, 120] as const
const BORDER = [226, 220, 208] as const

function frDate(value: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function frDateShort(value: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fr-FR')
}

function frNum(value: number, decimals = 2): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function frCurrency(value: number): string {
  return value.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  })
}

function minutesLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} h`
  return `${hours} h ${String(mins).padStart(2, '0')}`
}

function statusTone(status?: string): [number, number, number] {
  if (status === 'absent') return [170, 44, 44]
  if (status === 'en attente') return [24, 95, 165]
  return [15, 110, 86]
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

export async function generateTeacherReportPdf(data: TeacherReportData): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc: JsPDFType = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const logo = await loadLogoBase64()

  const pageWidth = 210
  const pageHeight = 297
  const marginX = 16
  const contentWidth = pageWidth - marginX * 2
  const headerHeight = 40

  doc.setFont('helvetica')

  function drawHeader(pageDoc: JsPDFType) {
    pageDoc.setFillColor(...NAVY)
    pageDoc.rect(0, 0, pageWidth, headerHeight, 'F')
    pageDoc.setFillColor(...GOLD)
    pageDoc.rect(0, headerHeight, pageWidth, 1.2, 'F')

    if (logo) {
      try {
        pageDoc.addImage(logo, 'PNG', marginX, 6, 28, 28)
      } catch {
        // ignore image errors and continue with text
      }
    }

    pageDoc.setTextColor(...WHITE)
    pageDoc.setFontSize(16)
    pageDoc.setFont('helvetica', 'bold')
    pageDoc.text('CAMBRIDGE CAMPUS', marginX + 34, 17)

    pageDoc.setTextColor(...GOLD)
    pageDoc.setFontSize(8)
    pageDoc.setFont('helvetica', 'normal')
    pageDoc.text('Practice Makes Perfect', marginX + 34, 23)

    pageDoc.setTextColor(...WHITE)
    pageDoc.setFontSize(9)
    pageDoc.setFont('helvetica', 'bold')
    pageDoc.text('RAPPORT PERSONNEL DE POINTAGE', pageWidth - marginX, 17, { align: 'right' })
    pageDoc.setTextColor(...GOLD)
    pageDoc.setFont('helvetica', 'normal')
    pageDoc.text(`${frDateShort(data.period_from)} — ${frDateShort(data.period_to)}`, pageWidth - marginX, 24, { align: 'right' })
  }

  function drawFooter(pageDoc: JsPDFType, pageNumber: number, pageCount: number) {
    const y = pageHeight - 10
    pageDoc.setFillColor(...NAVY)
    pageDoc.rect(0, pageHeight - 16, pageWidth, 16, 'F')
    pageDoc.setTextColor(...GOLD)
    pageDoc.setFontSize(7.5)
    pageDoc.text('Cambridge Campus · ProfCheck', marginX, y)
    pageDoc.setTextColor(196, 188, 174)
    pageDoc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, pageWidth / 2, y, { align: 'center' })
    pageDoc.text(`Page ${pageNumber} / ${pageCount}`, pageWidth - marginX, y, { align: 'right' })
  }

  drawHeader(doc)
  let cursorY = headerHeight + 12

  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Rapport de présence et de paie', marginX, cursorY)
  cursorY += 6
  doc.setFillColor(...GOLD)
  doc.rect(marginX, cursorY, 42, 0.8, 'F')
  cursorY += 6

  doc.setFillColor(...CREAM)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(marginX, cursorY, contentWidth, 27, 3, 3, 'FD')
  doc.setFillColor(...GOLD)
  doc.roundedRect(marginX, cursorY, 3, 27, 1.5, 1.5, 'F')

  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(data.teacher_name, marginX + 8, cursorY + 8)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  if (data.teacher_email) doc.text(data.teacher_email, marginX + 8, cursorY + 14)
  if (data.teacher_id) doc.text(`Réf. professeur : ${data.teacher_id}`, marginX + 8, cursorY + 19)
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('PÉRIODE', pageWidth - marginX - 42, cursorY + 7)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(frDate(data.period_from), pageWidth - marginX - 42, cursorY + 13)
  doc.text(`au ${frDate(data.period_to)}`, pageWidth - marginX - 42, cursorY + 19)
  cursorY += 35

  const cards = [
    { label: 'Séances', value: String(data.total_sessions), unit: 'sessions' },
    { label: 'Heures totales', value: frNum(data.total_hours, 1), unit: 'heures' },
    { label: 'Taux horaire', value: frCurrency(data.hourly_rate), unit: '/ heure' },
    { label: 'Rémunération', value: frCurrency(data.estimated_payment), unit: 'estimée' },
  ]
  const cardWidth = (contentWidth - 18) / 4

  cards.forEach((card, index) => {
    const x = marginX + index * (cardWidth + 6)
    doc.setFillColor(...WHITE)
    doc.setDrawColor(...BORDER)
    doc.roundedRect(x, cursorY, cardWidth, 24, 3, 3, 'FD')
    doc.setFillColor(...GOLD)
    doc.roundedRect(x, cursorY, cardWidth, 2, 1, 1, 'F')
    doc.setTextColor(...GRAY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(card.label.toUpperCase(), x + cardWidth / 2, cursorY + 7, { align: 'center' })
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(index >= 2 ? 9 : 13)
    doc.text(card.value, x + cardWidth / 2, cursorY + 15, { align: 'center' })
    doc.setTextColor(...GRAY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.text(card.unit, x + cardWidth / 2, cursorY + 20, { align: 'center' })
  })

  cursorY += 32
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Détail des séances', marginX, cursorY)
  doc.setFillColor(...GOLD)
  doc.rect(marginX, cursorY + 2, 28, 0.7, 'F')
  cursorY += 8

  autoTable(doc, {
    startY: cursorY,
    head: [[
      '#',
      'Date',
      'Début',
      'Fin',
      'Durée',
      'Salle',
      'Matière',
      'Statut',
    ]],
    body: data.sessions.map((session, index) => [
      index + 1,
      frDateShort(session.date),
      session.start_time || '—',
      session.end_time || '—',
      minutesLabel(session.duration_minutes),
      session.room || '—',
      session.subject || '—',
      session.status || 'validé',
    ]),
    foot: [[
      '',
      '',
      '',
      'TOTAL',
      minutesLabel(data.sessions.reduce((sum, session) => sum + session.duration_minutes, 0)),
      '',
      '',
      '',
    ]],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.6,
      textColor: [60, 55, 50],
      lineColor: BORDER,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: NAVY,
      textColor: WHITE,
      fontStyle: 'bold',
    },
    footStyles: {
      fillColor: [246, 241, 232],
      textColor: NAVY,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [252, 250, 246],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 24 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 22 },
      5: { cellWidth: 34 },
      6: { cellWidth: 34 },
      7: { halign: 'center', cellWidth: 22 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 7) {
        hookData.cell.styles.textColor = statusTone(String(hookData.cell.raw))
        hookData.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: (hookData) => {
      drawHeader(hookData.doc)
      const totalPages = hookData.doc.getNumberOfPages()
      drawFooter(hookData.doc, hookData.pageNumber, totalPages)
    },
    margin: { top: headerHeight + 10, left: marginX, right: marginX, bottom: 24 },
  })

  const finalY = (doc as JsPDFType & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 190
  const recapY = finalY + 10

  doc.setFillColor(...CREAM)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(marginX, recapY, contentWidth, 28, 3, 3, 'FD')
  doc.setFillColor(...GOLD)
  doc.roundedRect(marginX, recapY, 3, 28, 1.5, 1.5, 'F')
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Récapitulatif de paie', marginX + 8, recapY + 7)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`Heures validées : ${frNum(data.total_hours, 2)} h`, marginX + 8, recapY + 14)
  doc.text(`Taux horaire : ${frCurrency(data.hourly_rate)}`, marginX + 8, recapY + 19)
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.text(`Total estimé : ${frCurrency(data.estimated_payment)}`, marginX + 8, recapY + 24)

  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.text('Document généré automatiquement à titre de suivi interne et de préparation de paie.', marginX, pageHeight - 22)

  doc.save(`rapport_professeur_${data.teacher_name.replace(/\s+/g, '_').toLowerCase()}_${data.period_from}_${data.period_to}.pdf`)
}
