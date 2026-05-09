import type { jsPDF as JsPDFType } from 'jspdf'

export interface StudentAttendanceSheetRow {
  student_name: string
  status: 'present' | 'absent' | 'late' | 'excused'
  marked_at?: string | null
  source?: 'qr' | 'teacher' | 'admin' | 'reception' | null
  signed?: boolean
}

export interface StudentAttendanceSheetData {
  center_name: string
  class_name: string
  level?: string | null
  teacher_name?: string | null
  attendance_date: string
  generated_at: string
  total_students: number
  summary: {
    present: number
    late: number
    excused: number
    absent: number
  }
  rows: StudentAttendanceSheetRow[]
}

const NAVY: [number, number, number] = [27, 45, 91]
const GOLD: [number, number, number] = [201, 168, 76]
const WHITE: [number, number, number] = [255, 255, 255]
const CREAM: [number, number, number] = [250, 248, 243]
const GRAY: [number, number, number] = [96, 104, 120]
const BORDER: [number, number, number] = [226, 220, 208]

function colorTuple(color: readonly [number, number, number]): [number, number, number] {
  return [color[0], color[1], color[2]]
}

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

function frTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(status: StudentAttendanceSheetRow['status']): string {
  switch (status) {
    case 'late':
      return 'Retard'
    case 'excused':
      return 'Excusé'
    case 'absent':
      return 'Absent'
    default:
      return 'Présent'
  }
}

function sourceLabel(source?: StudentAttendanceSheetRow['source']): string {
  switch (source) {
    case 'teacher':
      return 'Prof'
    case 'admin':
      return 'Admin'
    case 'reception':
      return 'Accueil'
    case 'qr':
      return 'QR'
    default:
      return '—'
  }
}

function statusTone(status: StudentAttendanceSheetRow['status']): [number, number, number] {
  switch (status) {
    case 'absent':
      return [170, 44, 44]
    case 'late':
      return [180, 83, 9]
    case 'excused':
      return [24, 95, 165]
    default:
      return [15, 110, 86]
  }
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

export async function generateStudentAttendanceSheetPdf(data: StudentAttendanceSheetData): Promise<void> {
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
        // ignore image errors
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
    pageDoc.text('FEUILLE DE PRÉSENCE ÉTUDIANTS', pageWidth - marginX, 17, { align: 'right' })
    pageDoc.setTextColor(...GOLD)
    pageDoc.setFont('helvetica', 'normal')
    pageDoc.text(frDate(data.attendance_date), pageWidth - marginX, 24, { align: 'right' })
  }

  function drawFooter(pageDoc: JsPDFType, pageNumber: number, pageCount: number) {
    const y = pageHeight - 10
    pageDoc.setFillColor(...NAVY)
    pageDoc.rect(0, pageHeight - 16, pageWidth, 16, 'F')
    pageDoc.setTextColor(...GOLD)
    pageDoc.setFontSize(7.5)
    pageDoc.text('Cambridge Campus · Feuille de présence étudiants', marginX, y)
    pageDoc.setTextColor(196, 188, 174)
    pageDoc.text(`Généré le ${new Date(data.generated_at).toLocaleString('fr-FR')}`, pageWidth / 2, y, { align: 'center' })
    pageDoc.text(`Page ${pageNumber} / ${pageCount}`, pageWidth - marginX, y, { align: 'right' })
  }

  drawHeader(doc)
  let cursorY = headerHeight + 12

  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(data.class_name, marginX, cursorY)
  cursorY += 6
  doc.setFillColor(...GOLD)
  doc.rect(marginX, cursorY, 36, 0.8, 'F')
  cursorY += 6

  doc.setFillColor(...CREAM)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(marginX, cursorY, contentWidth, 27, 3, 3, 'FD')
  doc.setFillColor(...GOLD)
  doc.roundedRect(marginX, cursorY, 3, 27, 1.5, 1.5, 'F')

  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(data.center_name, marginX + 8, cursorY + 8)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`Date : ${frDate(data.attendance_date)}`, marginX + 8, cursorY + 14)
  doc.text(`Classe : ${data.class_name}${data.level ? ` · ${data.level}` : ''}`, marginX + 8, cursorY + 19)
  doc.text(`Professeur : ${data.teacher_name || 'Non attribué'}`, marginX + 8, cursorY + 24)

  const rightX = pageWidth - marginX - 58
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('EFFECTIF', rightX, cursorY + 7)
  doc.text('PRÉSENTS', rightX, cursorY + 13)
  doc.text('ABSENTS', rightX, cursorY + 19)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  doc.text(String(data.total_students), pageWidth - marginX, cursorY + 7, { align: 'right' })
  doc.text(String(data.summary.present + data.summary.late + data.summary.excused), pageWidth - marginX, cursorY + 13, { align: 'right' })
  doc.text(String(data.summary.absent), pageWidth - marginX, cursorY + 19, { align: 'right' })

  cursorY += 35

  autoTable(doc, {
    startY: cursorY,
    head: [[
      '#',
      'Étudiant',
      'Statut',
      'Heure',
      'Source',
      'Signature',
    ]],
    body: data.rows.map((row, index) => [
      index + 1,
      row.student_name,
      statusLabel(row.status),
      frTime(row.marked_at),
      sourceLabel(row.source),
      row.signed ? 'Oui' : '—',
    ]),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.6,
      textColor: [60, 55, 50],
      lineColor: colorTuple(BORDER),
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: colorTuple(NAVY),
      textColor: colorTuple(WHITE),
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [252, 250, 246],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 78 },
      2: { halign: 'center', cellWidth: 26 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 22 },
      5: { halign: 'center', cellWidth: 22 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 2) {
        hookData.cell.styles.textColor = statusTone(data.rows[hookData.row.index]?.status || 'present')
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

  const finalY = (doc as JsPDFType & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 200
  const summaryY = finalY + 10

  doc.setFillColor(...CREAM)
  doc.setDrawColor(...BORDER)
  doc.roundedRect(marginX, summaryY, contentWidth, 24, 3, 3, 'FD')
  doc.setFillColor(...GOLD)
  doc.roundedRect(marginX, summaryY, 3, 24, 1.5, 1.5, 'F')
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Résumé de séance', marginX + 8, summaryY + 7)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`Présents : ${data.summary.present}`, marginX + 8, summaryY + 14)
  doc.text(`Retards : ${data.summary.late}`, marginX + 46, summaryY + 14)
  doc.text(`Excusés : ${data.summary.excused}`, marginX + 82, summaryY + 14)
  doc.text(`Absents : ${data.summary.absent}`, marginX + 122, summaryY + 14)
  doc.text('Les étudiants sans pointage sont comptés absents sur cette feuille.', marginX + 8, summaryY + 20)

  const safeClassName = data.class_name.replace(/\s+/g, '_').toLowerCase()
  doc.save(`feuille_presence_${safeClassName}_${data.attendance_date}.pdf`)
}
