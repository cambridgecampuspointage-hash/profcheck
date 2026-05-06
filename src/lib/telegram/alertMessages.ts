const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function dashboardLink(path: string, label: string) {
  return `<a href='${APP_URL}${path}'>→ ${label}</a>`
}

export function buildTeacherAbsentMessage(params: {
  teacherName: string
  scheduledTime: string
  roomName: string
  date: string
}): string {
  return [
    '🔴 <b>Professeur absent</b>',
    '',
    `👤 <b>${params.teacherName}</b>`,
    `🏫 ${params.roomName}`,
    `🕐 Créneau prévu : ${params.scheduledTime.replace(':', 'h')}`,
    `📅 ${params.date}`,
    '',
    '❌ Aucun pointage enregistré.',
    '',
    dashboardLink('/admin/planning', 'Voir le planning'),
  ].join('\n')
}

export function buildTeacherLateMessage(params: {
  teacherName: string
  scheduledTime: string
  minutesLate: number
  roomName: string
  date: string
}): string {
  return [
    '⚠️ <b>Professeur en retard</b>',
    '',
    `👤 <b>${params.teacherName}</b>`,
    `🏫 ${params.roomName}`,
    `🕐 Prévu à ${params.scheduledTime.replace(':', 'h')} — ${params.minutesLate} min de retard`,
    `📅 ${params.date}`,
    '',
    dashboardLink('/dashboard', 'Voir le dashboard'),
  ].join('\n')
}

export function buildOutOfPlanningMessage(params: {
  teacherName: string
  scanTime: string
  roomName: string
  date: string
}): string {
  return [
    '🟠 <b>Session hors planning</b>',
    '',
    `👤 <b>${params.teacherName}</b>`,
    `🏫 ${params.roomName}`,
    `🕐 Pointage à ${params.scanTime.replace(':', 'h')}`,
    `📅 ${params.date}`,
    '',
    '📍 Aucun créneau planifié associé.',
    '',
    dashboardLink('/dashboard', 'Voir le dashboard'),
  ].join('\n')
}

export function buildStaffLateMessage(params: {
  staffName: string
  expectedStart: string
  minutesLate: number
  date: string
}): string {
  return [
    '⚠️ <b>Réceptionniste en retard</b>',
    '',
    `👤 <b>${params.staffName}</b>`,
    `🕐 Prévu à ${params.expectedStart.replace(':', 'h')} — ${params.minutesLate} min de retard`,
    `📅 ${params.date}`,
    '',
    dashboardLink('/dashboard/reception', 'Voir la réception'),
  ].join('\n')
}

export function buildStaffAbsentMessage(params: {
  staffName: string
  expectedStart: string
  date: string
}): string {
  return [
    '🔴 <b>Réceptionniste absente</b>',
    '',
    `👤 <b>${params.staffName}</b>`,
    `🕐 Heure prévue : ${params.expectedStart.replace(':', 'h')}`,
    `📅 ${params.date}`,
    '',
    '❌ Aucun clock-in enregistré.',
    '',
    dashboardLink('/dashboard/reception', 'Voir la réception'),
  ].join('\n')
}

export function buildStaffLongBreakMessage(params: {
  staffName: string
  breakStart: string
  currentDuration: number
  maxAllowed: number
  date: string
}): string {
  return [
    '🟠 <b>Pause excessive</b>',
    '',
    `👤 <b>${params.staffName}</b>`,
    `🕐 Pause depuis ${params.breakStart.replace(':', 'h')}`,
    `⌛ ${params.currentDuration} min en cours — max ${params.maxAllowed} min`,
    `📅 ${params.date}`,
    '',
    dashboardLink('/dashboard/reception', 'Voir la réception'),
  ].join('\n')
}

export function buildStaffEarlyLeaveMessage(params: {
  staffName: string
  clockOut: string
  expectedEnd: string
  minutesEarly: number
  date: string
}): string {
  return [
    '🟠 <b>Départ anticipé</b>',
    '',
    `👤 <b>${params.staffName}</b>`,
    `🕐 Départ à ${params.clockOut.replace(':', 'h')} — prévu ${params.expectedEnd.replace(':', 'h')}`,
    `⌛ Écart : ${params.minutesEarly} min`,
    `📅 ${params.date}`,
    '',
    dashboardLink('/dashboard/reception', 'Voir la réception'),
  ].join('\n')
}

export function buildStaffMissingClockOutMessage(params: {
  staffName: string
  expectedEnd: string
  date: string
}): string {
  return [
    '🔴 <b>Pointage départ manquant</b>',
    '',
    `👤 <b>${params.staffName}</b>`,
    `🕐 Fin prévue : ${params.expectedEnd.replace(':', 'h')}`,
    `📅 ${params.date}`,
    '',
    '❌ Aucun clock-out enregistré après la fin de journée.',
    '',
    dashboardLink('/dashboard/reception', 'Voir la réception'),
  ].join('\n')
}

export function buildDailySummaryMessage(params: {
  date: string
  completedSessions: number
  absentTeachers: number
  outOfPlanning: number
  staffPresent: boolean
  staffHours: string
  totalAlertsToday: number
}): string {
  return [
    '📘 <b>Résumé quotidien Cambridge Campus</b>',
    '',
    `📅 ${params.date}`,
    `✅ Sessions complétées : ${params.completedSessions}`,
    `❌ Absences profs : ${params.absentTeachers}`,
    `🟠 Hors planning : ${params.outOfPlanning}`,
    `🧑‍💼 Réception : ${params.staffPresent ? `présente (${params.staffHours})` : 'absence détectée'}`,
    `🔔 Alertes du jour : ${params.totalAlertsToday}`,
    '',
    dashboardLink('/dashboard', 'Voir le dashboard'),
  ].join('\n')
}
