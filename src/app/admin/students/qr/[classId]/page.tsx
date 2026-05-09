'use client'

import { useCallback, useEffect, useMemo, useState, use } from 'react'
import { generateStudentCheckinToken } from '@/lib/actions'
import { generateStudentAttendanceSheetPdf } from '@/lib/pdf/generateStudentAttendanceSheet'
import { createClient } from '@/lib/supabase/client'
import { QRCodeSVG } from 'qrcode.react'
import { AlertCircle, Download, Loader2, RefreshCw } from 'lucide-react'
import type { Center, Student, StudentCheckinToken } from '@/lib/types'

export default function StudentQrDisplayPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params)
  const supabase = useMemo(() => createClient(), [])
  const [className, setClassName] = useState('Classe')
  const [classData, setClassData] = useState<{
    name: string
    level: string | null
    center: Center | null
    teacher: { full_name: string } | null
  } | null>(null)
  const [checkinToken, setCheckinToken] = useState<StudentCheckinToken | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  const appUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    }
    return process.env.NEXT_PUBLIC_APP_URL || ''
  }, [])

  const qrUrl = checkinToken ? `${appUrl}/student/check-in/${checkinToken.token}` : ''

  const loadToken = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await generateStudentCheckinToken(classId)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    setCheckinToken(result.data || null)
    setLoading(false)
  }, [classId])

  const handleDownloadAttendanceSheet = useCallback(async () => {
    setDownloading(true)
    const today = new Date().toISOString().split('T')[0]

    const [membersRes, attendanceRes] = await Promise.all([
      supabase
        .from('student_class_members')
        .select('student:students(id, full_name)')
        .eq('class_id', classId),
      supabase
        .from('student_attendance')
        .select('student_id, status, marked_at, source, signature_data_url')
        .eq('class_id', classId)
        .eq('attendance_date', today),
    ])

    if (membersRes.error || attendanceRes.error) {
      setDownloading(false)
      window.alert(membersRes.error?.message || attendanceRes.error?.message || 'Impossible de générer la feuille.')
      return
    }

    const classStudents = (membersRes.data || [])
      .map((row) => Array.isArray(row.student) ? row.student[0] : row.student)
      .filter((student): student is Pick<Student, 'id' | 'full_name'> => Boolean(student))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr'))

    const attendanceMap = new Map(
      (attendanceRes.data || []).map((row) => [
        row.student_id as string,
        {
          status: row.status as 'present' | 'absent' | 'late' | 'excused',
          marked_at: row.marked_at as string | null,
          source: row.source as 'qr' | 'teacher' | 'admin' | 'reception' | null,
          signed: Boolean(row.signature_data_url),
        },
      ]),
    )

    const rows = classStudents.map((student) => {
      const attendance = attendanceMap.get(student.id)
      return {
        student_name: student.full_name,
        status: attendance?.status || 'absent',
        marked_at: attendance?.marked_at || null,
        source: attendance?.source || null,
        signed: attendance?.signed || false,
      }
    })

    const summary = rows.reduce(
      (acc, row) => {
        acc[row.status] += 1
        return acc
      },
      { present: 0, late: 0, excused: 0, absent: 0 },
    )

    try {
      await generateStudentAttendanceSheetPdf({
        center_name: classData?.center?.name || 'Cambridge Campus',
        class_name: classData?.name || className,
        level: classData?.level || null,
        teacher_name: classData?.teacher?.full_name || null,
        attendance_date: today,
        generated_at: new Date().toISOString(),
        total_students: classStudents.length,
        summary,
        rows,
      })
    } finally {
      setDownloading(false)
    }
  }, [classData, classId, className, supabase])

  useEffect(() => {
    let active = true

    async function bootstrap() {
      const [classRes, tokenRes] = await Promise.all([
        supabase
          .from('student_classes')
          .select('name, level, center:centers(*), teacher:teachers(full_name)')
          .eq('id', classId)
          .maybeSingle(),
        generateStudentCheckinToken(classId),
      ])

      if (!active) return

      setClassName(classRes.data?.name || 'Classe')
      setClassData(
        classRes.data
          ? {
              name: classRes.data.name,
              level: classRes.data.level ?? null,
              center: Array.isArray(classRes.data.center) ? classRes.data.center[0] || null : classRes.data.center || null,
              teacher: Array.isArray(classRes.data.teacher) ? classRes.data.teacher[0] || null : classRes.data.teacher || null,
            }
          : null,
      )
      if (tokenRes.error) {
        setError(tokenRes.error)
      } else {
        setCheckinToken(tokenRes.data || null)
      }
      setLoading(false)
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [classId, supabase])

  if (error) {
    return (
      <div className="qr-display-page">
        <div style={{ textAlign: 'center' }}>
          <AlertCircle size={64} color="#ef4444" style={{ marginBottom: '1.5rem' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Erreur</h1>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-primary btn-lg" onClick={() => void loadToken()}>
            <RefreshCw size={18} /> Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="qr-display-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#0f766e' }} />
        <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Check-in étudiant</span>
      </div>

      {loading || !checkinToken ? (
        <Loader2 size={64} style={{ animation: 'spin 1s linear infinite', color: '#0f766e' }} />
      ) : (
        <>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1b2d5b' }}>{className}</div>
            <p style={{ color: '#64748b' }}>Les étudiants scannent puis choisissent leur nom avant de signer.</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => void handleDownloadAttendanceSheet()} disabled={downloading}>
              <Download size={14} /> {downloading ? 'Préparation...' : 'Télécharger la feuille du jour'}
            </button>
          </div>

          <div style={{
            background: 'white',
            borderRadius: 24,
            padding: '2rem',
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
            marginBottom: '1.5rem',
          }}>
            <QRCodeSVG
              value={qrUrl}
              size={320}
              level="H"
              includeMargin
              style={{ display: 'block' }}
            />
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.92)',
            borderRadius: 18,
            padding: '1rem 1.25rem',
            maxWidth: 520,
            textAlign: 'center',
            boxShadow: '0 18px 40px rgba(0,0,0,0.16)',
          }}>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '0.35rem' }}>Lien direct de check-in</p>
            <div style={{ color: '#1b2d5b', fontSize: '0.92rem', fontWeight: 700, wordBreak: 'break-all' }}>{qrUrl}</div>
          </div>
        </>
      )}
    </div>
  )
}
