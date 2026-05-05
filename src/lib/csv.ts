/**
 * Utilitaires d'export CSV pour rapports de paie/pointage.
 * Cible: Excel francais (separateur ";" / virgule decimale / UTF-8 BOM)
 */

const SEP = ';'

export function frNum(value: number, decimals = 2): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function frCurrency(value: number): string {
  return value.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  })
}

export function frDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return Number.isNaN(date.getTime())
    ? dateStr
    : date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
}

function cell(value: string | number | null | undefined, isNumeric = false): string {
  if (value === null || value === undefined) return '""'
  if (isNumeric) return String(value)
  const stringValue = String(value).replace(/"/g, '""')
  return `"${stringValue}"`
}

const BLANK_ROW = Array(8).fill('""').join(SEP)

function sectionTitle(label: string): string {
  return [cell(`▌ ${label}`), ...Array(7).fill('""')].join(SEP)
}

function metaRow(key: string, value: string, extraCols = 6): string {
  return [cell(key), cell(value), ...Array(extraCols).fill('""')].join(SEP)
}

export interface ExportRow {
  teacher_name: string
  total_sessions: number
  total_hours: number
  hourly_rate: number
  estimated_payment: number
}

export interface ExportOptions {
  teacherName: string
  dateFrom: string
  dateTo: string
  rows: ExportRow[]
}

export function buildPayrollCsv(options: ExportOptions): string {
  const { teacherName, dateFrom, dateTo, rows } = options
  const generatedAt = new Date().toLocaleString('fr-FR')
  const periodLabel = `${frDate(dateFrom)} au ${frDate(dateTo)}`

  const totalSessions = rows.reduce((sum, row) => sum + row.total_sessions, 0)
  const totalHours = rows.reduce((sum, row) => sum + row.total_hours, 0)
  const totalPayment = rows.reduce((sum, row) => sum + row.estimated_payment, 0)
  const averageHourlyRate = rows.length
    ? rows.reduce((sum, row) => sum + row.hourly_rate, 0) / rows.length
    : 0

  const columnHeaders = [
    'Professeur',
    'Nb sessions',
    'Heures totales',
    'Taux horaire (€)',
    'Rémunération estimée (€)',
    '% du total heures',
    '% du total paiement',
    'Statut',
  ]

  const meta = [
    sectionTitle('RAPPORT DE PAIE - CAMBRIDGE CAMPUS'),
    BLANK_ROW,
    metaRow('Professeur', teacherName),
    metaRow('Période', periodLabel),
    metaRow('Généré le', generatedAt),
    metaRow('Nb. de lignes', String(rows.length)),
    BLANK_ROW,
  ]

  const summary = [
    sectionTitle('RÉSUMÉ'),
    BLANK_ROW,
    metaRow('Total sessions', String(totalSessions)),
    metaRow('Total heures', `${frNum(totalHours)} h`),
    metaRow('Taux horaire moyen', frCurrency(averageHourlyRate)),
    metaRow('Rémunération totale', frCurrency(totalPayment)),
    BLANK_ROW,
    sectionTitle('DÉTAIL PAR PROFESSEUR'),
    BLANK_ROW,
  ]

  const header = columnHeaders.map((column) => cell(column)).join(SEP)

  const dataRows = rows.map((row) => {
    const hoursPercentage = totalHours > 0 ? (row.total_hours / totalHours) * 100 : 0
    const paymentPercentage = totalPayment > 0 ? (row.estimated_payment / totalPayment) * 100 : 0
    const status = row.estimated_payment > 0 ? 'À payer' : 'En attente'

    return [
      cell(row.teacher_name),
      cell(row.total_sessions, true),
      cell(frNum(row.total_hours)),
      cell(frNum(row.hourly_rate)),
      cell(frNum(row.estimated_payment)),
      cell(`${frNum(hoursPercentage, 1)} %`),
      cell(`${frNum(paymentPercentage, 1)} %`),
      cell(status),
    ].join(SEP)
  })

  const totalsRow = [
    cell('TOTAL'),
    cell(totalSessions, true),
    cell(frNum(totalHours)),
    cell(`${frNum(averageHourlyRate)} (moy.)`),
    cell(frNum(totalPayment)),
    cell('100,0 %'),
    cell('100,0 %'),
    cell(''),
  ].join(SEP)

  const lines = [
    ...meta,
    ...summary,
    header,
    ...dataRows,
    BLANK_ROW,
    totalsRow,
    BLANK_ROW,
    metaRow('Fin du rapport', `${rows.length} entrée(s) exportée(s) - Cambridge Campus ProfCheck`),
  ]

  return lines.join('\n')
}

export function payrollFilename(dateFrom: string, dateTo: string): string {
  const from = dateFrom.replace(/\//g, '-')
  const to = dateTo.replace(/\//g, '-')
  return `rapport_paie_${from}_${to}.csv`
}

export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
