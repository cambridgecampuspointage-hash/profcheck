import { getTeacherCorrectionRequests, getTeacherHistory } from '@/lib/actions'
import TeacherHistoryClient from './teacher-history-client'

export default async function TeacherHistoryPage() {
  const [sessions, correctionRequests] = await Promise.all([
    getTeacherHistory(),
    getTeacherCorrectionRequests(),
  ])

  return (
    <TeacherHistoryClient
      initialSessions={sessions}
      initialCorrectionRequests={correctionRequests}
    />
  )
}
