type PaymentAwareStudent = {
  payment_due_date?: string | null
  access_status?: 'allowed' | 'blocked' | string | null
}

export type StudentPaymentState = 'ok' | 'overdue'

function parseLocalDate(date: string) {
  return new Date(`${date}T00:00:00`)
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function getStudentPaymentState(student: PaymentAwareStudent): StudentPaymentState {
  if (!student.payment_due_date) return 'ok'
  return parseLocalDate(student.payment_due_date) < startOfToday() ? 'overdue' : 'ok'
}

export function isStudentEffectivelyBlocked(student: PaymentAwareStudent) {
  return student.access_status === 'blocked' || getStudentPaymentState(student) === 'overdue'
}
