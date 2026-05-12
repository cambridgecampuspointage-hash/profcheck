'use client'

import Link from 'next/link'
import type { CSSProperties, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateStudentAttendanceSheetPdf } from '@/lib/pdf/generateStudentAttendanceSheet'
import { getStudentPaymentState, isStudentEffectivelyBlocked } from '@/lib/student-payments'
import {
  createStudent,
  createStudentClass,
  deleteStudent,
  markStudentPresentForToday,
  recordStudentPayment,
  setStudentAccess,
  updateStudent,
  updateStudentClass,
} from '@/lib/actions'
import type { Center, Student, StudentClass, StudentPaymentRecord, Teacher } from '@/lib/types'
import { GraduationCap, Plus, QrCode, ShieldAlert, ShieldCheck, Users, X, Edit2, CalendarClock, CreditCard, CheckCircle2, Download, Trash2 } from 'lucide-react'

type StudentMembershipRow = {
  class_id: string
  student_id: string
  class: Pick<StudentClass, 'id' | 'name'> | null
}

type TeacherOption = Pick<Teacher, 'id' | 'full_name'> & { status?: string }

function formatDate(date: string | null) {
  if (!date) return 'Aucune échéance'
  return new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR')
}

export default function AdminStudentsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<StudentClass[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [centers, setCenters] = useState<Center[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [memberships, setMemberships] = useState<StudentMembershipRow[]>([])
  const [paymentRecords, setPaymentRecords] = useState<StudentPaymentRecord[]>([])
  const [showClassModal, setShowClassModal] = useState(false)
  const [showStudentModal, setShowStudentModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingClass, setEditingClass] = useState<StudentClass | null>(null)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null)
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null)
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null)
  const [markingKey, setMarkingKey] = useState<string | null>(null)
  const [downloadingClassId, setDownloadingClassId] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    const [
      classesRes,
      studentsRes,
      centersRes,
      teachersRes,
      membershipsRes,
      paymentRecordsRes,
    ] = await Promise.all([
      supabase.from('student_classes').select('*, center:centers(*), teacher:teachers(id, full_name)').order('name'),
      supabase.from('students').select('*, center:centers(*)').order('full_name'),
      supabase.from('centers').select('*').order('name'),
      supabase.from('teachers').select('id, full_name, status').eq('status', 'active').order('full_name'),
      supabase.from('student_class_members').select('class_id, student_id, class:student_classes(id, name)'),
      supabase.from('student_payment_records').select('*').order('paid_at', { ascending: false }).order('created_at', { ascending: false }).limit(300),
    ])

    setClasses((classesRes.data || []) as StudentClass[])
    setStudents((studentsRes.data || []) as Student[])
    setCenters((centersRes.data || []) as Center[])
    setTeachers((teachersRes.data || []) as TeacherOption[])
    setMemberships(((membershipsRes.data || []) as unknown as StudentMembershipRow[]).map((row) => ({
      ...row,
      class: Array.isArray(row.class) ? row.class[0] || null : row.class,
    })))
    setPaymentRecords((paymentRecordsRes.data || []) as StudentPaymentRecord[])
    setLoading(false)
  }

  useEffect(() => {
    let active = true

    async function bootstrap() {
      const [
        classesRes,
        studentsRes,
        centersRes,
        teachersRes,
        membershipsRes,
        paymentRecordsRes,
      ] = await Promise.all([
        supabase.from('student_classes').select('*, center:centers(*), teacher:teachers(id, full_name)').order('name'),
        supabase.from('students').select('*, center:centers(*)').order('full_name'),
        supabase.from('centers').select('*').order('name'),
        supabase.from('teachers').select('id, full_name, status').eq('status', 'active').order('full_name'),
        supabase.from('student_class_members').select('class_id, student_id, class:student_classes(id, name)'),
        supabase.from('student_payment_records').select('*').order('paid_at', { ascending: false }).order('created_at', { ascending: false }).limit(300),
      ])

      if (!active) return

      setClasses((classesRes.data || []) as StudentClass[])
      setStudents((studentsRes.data || []) as Student[])
      setCenters((centersRes.data || []) as Center[])
      setTeachers((teachersRes.data || []) as TeacherOption[])
      setMemberships(((membershipsRes.data || []) as unknown as StudentMembershipRow[]).map((row) => ({
        ...row,
        class: Array.isArray(row.class) ? row.class[0] || null : row.class,
      })))
      setPaymentRecords((paymentRecordsRes.data || []) as StudentPaymentRecord[])
      setLoading(false)
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [supabase])

  const membershipMap = useMemo(() => {
    const map = new Map<string, StudentMembershipRow[]>()
    memberships.forEach((row) => {
      const current = map.get(row.student_id) || []
      current.push(row)
      map.set(row.student_id, current)
    })
    return map
  }, [memberships])

  const classCounts = useMemo(() => {
    const counts = new Map<string, number>()
    memberships.forEach((row) => {
      counts.set(row.class_id, (counts.get(row.class_id) || 0) + 1)
    })
    return counts
  }, [memberships])

  const paymentRecordsMap = useMemo(() => {
    const map = new Map<string, StudentPaymentRecord[]>()
    paymentRecords.forEach((row) => {
      const current = map.get(row.student_id) || []
      current.push(row)
      map.set(row.student_id, current)
    })
    return map
  }, [paymentRecords])

  const handleAccessToggle = async (student: Student) => {
    const nextStatus = student.access_status === 'allowed' ? 'blocked' : 'allowed'
    let reason: string | null = null

    if (nextStatus === 'blocked') {
      reason = window.prompt('Raison interne du blocage (optionnel) :') || ''
    }

    setUpdatingStudentId(student.id)
    const result = await setStudentAccess(student.id, nextStatus, reason)
    setUpdatingStudentId(null)

    if (result.error) {
      window.alert(result.error)
      return
    }

    void loadData()
  }

  const handleMarkPresent = async (studentId: string, classId: string) => {
    setMarkingKey(`${studentId}:${classId}`)
    const result = await markStudentPresentForToday({ student_id: studentId, class_id: classId })
    setMarkingKey(null)

    if ('error' in result && result.error) {
      window.alert(result.error)
      return
    }

    window.alert('Présence enregistrée pour aujourd’hui.')
  }

  const handleDeleteStudent = async (student: Student) => {
    const confirmation = window.prompt(`Pour supprimer l'étudiant "${student.full_name}", tapez SUPPRIMER`)
    if (confirmation !== 'SUPPRIMER') return

    setDeletingStudentId(student.id)
    const result = await deleteStudent(student.id)
    setDeletingStudentId(null)

    if ('error' in result && result.error) {
      window.alert(result.error)
      return
    }

    void loadData()
  }

  const handleDownloadAttendanceSheet = async (studentClass: StudentClass) => {
    setDownloadingClassId(studentClass.id)
    const today = new Date().toISOString().split('T')[0]

    const memberRows = memberships.filter((membership) => membership.class_id === studentClass.id)
    const classStudents = memberRows
      .map((membership) => students.find((student) => student.id === membership.student_id))
      .filter((student): student is Student => Boolean(student))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr'))

    const { data, error } = await supabase
      .from('student_attendance')
      .select('student_id, status, marked_at, source, signature_data_url')
      .eq('class_id', studentClass.id)
      .eq('attendance_date', today)

    if (error) {
      setDownloadingClassId(null)
      window.alert(error.message)
      return
    }

    const attendanceMap = new Map(
      (data || []).map((row) => [
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
        center_name: (studentClass.center as Center | undefined)?.name || 'Cambridge Campus',
        class_name: studentClass.name,
        level: studentClass.level,
        teacher_name: studentClass.teacher?.full_name || null,
        attendance_date: today,
        generated_at: new Date().toISOString(),
        total_students: classStudents.length,
        summary,
        rows,
      })
    } finally {
      setDownloadingClassId(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
          <GraduationCap size={22} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
          Étudiants & Classes
        </h1>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditingClass(null); setShowClassModal(true) }}>
            <Plus size={14} /> Ajouter une classe
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditingStudent(null); setShowStudentModal(true) }}>
            <Plus size={14} /> Ajouter un étudiant
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Users size={18} />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Classes</h2>
          </div>

          {loading ? (
            <div className="brand-empty">Chargement des classes…</div>
          ) : classes.length === 0 ? (
            <div className="brand-empty">Aucune classe créée pour le moment.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              {classes.map((studentClass) => (
                <div key={studentClass.id} style={{ border: '1px solid var(--brand-border)', borderRadius: 18, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--brand-navy)', fontSize: '1rem' }}>{studentClass.name}</div>
                      <div style={{ color: 'var(--brand-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                        {(studentClass.center as Center | undefined)?.name || 'Centre non lié'}
                        {studentClass.level ? ` • ${studentClass.level}` : ''}
                        {studentClass.teacher?.full_name ? ` • ${studentClass.teacher.full_name}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Link href={`/admin/students/qr/${studentClass.id}`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                        <QrCode size={14} /> QR étudiant
                      </Link>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleDownloadAttendanceSheet(studentClass)}
                        disabled={downloadingClassId === studentClass.id}
                      >
                        <Download size={14} /> {downloadingClassId === studentClass.id ? 'Préparation...' : 'Feuille du jour'}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingClass(studentClass)
                          setShowClassModal(true)
                        }}
                      >
                        <Edit2 size={14} /> Modifier
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', color: '#64748b', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                    <span>{classCounts.get(studentClass.id) || 0} étudiant(s)</span>
                    <span>Statut : {studentClass.status === 'active' ? 'active' : 'inactive'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <ShieldCheck size={18} />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Étudiants</h2>
          </div>

          {loading ? (
            <div className="brand-empty">Chargement des étudiants…</div>
          ) : students.length === 0 ? (
            <div className="brand-empty">Aucun étudiant enregistré.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              {students.map((student) => {
                const studentMemberships = membershipMap.get(student.id) || []
                const paymentState = getStudentPaymentState(student)
                const effectiveBlocked = isStudentEffectivelyBlocked(student)
                return (
                  <div key={student.id} style={{ border: '1px solid var(--brand-border)', borderRadius: 18, padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--brand-navy)', fontSize: '1rem' }}>{student.full_name}</div>
                        <div style={{ color: 'var(--brand-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                          {(student.center as Center | undefined)?.name || 'Centre non lié'}
                          {student.parent_phone ? ` • Parent: ${student.parent_phone}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEditingStudent(student)
                            setShowStudentModal(true)
                          }}
                        >
                          <Edit2 size={14} /> Modifier
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => void handleAccessToggle(student)}
                          disabled={updatingStudentId === student.id}
                          style={{
                            borderColor: student.access_status === 'blocked' ? '#0f766e' : '#fca5a5',
                            color: student.access_status === 'blocked' ? '#0f766e' : '#b91c1c',
                          }}
                        >
                          {student.access_status === 'blocked' ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                          {student.access_status === 'blocked' ? 'Débloquer' : 'Bloquer'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setPaymentStudent(student)
                            setShowPaymentModal(true)
                          }}
                        >
                          <CreditCard size={14} /> Paiement
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ borderColor: '#fecaca', color: '#b91c1c' }}
                          disabled={deletingStudentId === student.id}
                          onClick={() => void handleDeleteStudent(student)}
                        >
                          <Trash2 size={14} />
                          {deletingStudentId === student.id ? 'Suppression...' : 'Supprimer'}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                      <span className="badge">{student.status === 'active' ? 'Actif' : 'Inactif'}</span>
                      <span className="badge" style={{
                        background: effectiveBlocked ? 'rgba(239,68,68,0.14)' : 'rgba(16,185,129,0.14)',
                        color: effectiveBlocked ? '#b91c1c' : '#047857',
                      }}>
                        {effectiveBlocked ? 'Accès bloqué' : 'Accès autorisé'}
                      </span>
                      <span className="badge" style={{
                        background: paymentState === 'overdue' ? 'rgba(239,68,68,0.14)' : 'rgba(59,130,246,0.08)',
                        color: paymentState === 'overdue' ? '#b91c1c' : '#1d4ed8',
                      }}>
                        <CalendarClock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        Paiement : {formatDate(student.payment_due_date)}
                      </span>
                      {paymentState === 'overdue' ? (
                        <span className="badge" style={{ background: 'rgba(239,68,68,0.14)', color: '#b91c1c' }}>
                          Voir l’administration
                        </span>
                      ) : null}
                      {student.access_status === 'blocked' && paymentState !== 'overdue' ? (
                        <span className="badge" style={{ background: 'rgba(245,158,11,0.14)', color: '#b45309' }}>
                          Blocage manuel
                        </span>
                      ) : null}
                      {student.access_status === 'blocked' && student.access_block_reason ? (
                        <span className="badge" style={{ background: 'rgba(107,114,128,0.12)', color: '#4b5563' }}>
                          {student.access_block_reason}
                        </span>
                      ) : null}
                      {paymentState === 'overdue' && !student.access_block_reason ? (
                        <span className="badge" style={{ background: 'rgba(107,114,128,0.12)', color: '#4b5563' }}>
                          Blocage auto paiement
                        </span>
                      ) : null}
                    </div>

                    {studentMemberships.length > 0 ? (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                        {studentMemberships.map((membership) => (
                          <div key={`${membership.class_id}-${membership.student_id}`} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <span className="badge">
                              {membership.class?.name || 'Classe'}
                            </span>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.35rem 0.6rem' }}
                              onClick={() => void handleMarkPresent(student.id, membership.class_id)}
                              disabled={markingKey === `${student.id}:${membership.class_id}`}
                            >
                              <CheckCircle2 size={12} /> Présent aujourd’hui
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.75rem' }}>
                        Aucune classe liée.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showClassModal ? (
        <StudentClassModal
          centerOptions={centers}
          teacherOptions={teachers}
          studentClass={editingClass}
          onClose={() => {
            setShowClassModal(false)
            setEditingClass(null)
          }}
          onSaved={() => {
            setShowClassModal(false)
            setEditingClass(null)
            void loadData()
          }}
        />
      ) : null}

      {showStudentModal ? (
        <StudentModal
          centerOptions={centers}
          classOptions={classes}
          student={editingStudent}
          memberships={editingStudent ? membershipMap.get(editingStudent.id) || [] : []}
          onClose={() => {
            setShowStudentModal(false)
            setEditingStudent(null)
          }}
          onSaved={() => {
            setShowStudentModal(false)
            setEditingStudent(null)
            void loadData()
          }}
        />
      ) : null}

      {showPaymentModal && paymentStudent ? (
        <StudentPaymentModal
          student={paymentStudent}
          records={paymentRecordsMap.get(paymentStudent.id) || []}
          onClose={() => {
            setShowPaymentModal(false)
            setPaymentStudent(null)
          }}
          onSaved={() => {
            setShowPaymentModal(false)
            setPaymentStudent(null)
            void loadData()
          }}
        />
      ) : null}
    </div>
  )
}

function StudentClassModal({
  centerOptions,
  teacherOptions,
  studentClass,
  onClose,
  onSaved,
}: {
  centerOptions: Center[]
  teacherOptions: TeacherOption[]
  studentClass?: StudentClass | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(studentClass?.name || '')
  const [centerId, setCenterId] = useState(studentClass?.center_id || centerOptions[0]?.id || '')
  const [teacherId, setTeacherId] = useState(studentClass?.teacher_id || '')
  const [level, setLevel] = useState(studentClass?.level || '')
  const [status, setStatus] = useState<'active' | 'inactive'>(studentClass?.status || 'active')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      name,
      center_id: centerId,
      teacher_id: teacherId || null,
      level,
      status,
    }

    const result = studentClass
      ? await updateStudentClass(studentClass.id, payload)
      : await createStudentClass(payload)

    setSaving(false)
    if ('error' in result && result.error) {
      setError(result.error)
      return
    }

    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{studentClass ? 'Modifier la classe' : 'Ajouter une classe'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>
        {error ? <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: 12, marginBottom: '1rem' }}>{error}</div> : null}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
          <div>
            <label style={labelStyle}>Nom</label>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Centre</label>
            <select className="input" value={centerId} onChange={(event) => setCenterId(event.target.value)} required>
              {centerOptions.map((center) => (
                <option key={center.id} value={center.id}>{center.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Professeur référent</label>
            <select className="input" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
              <option value="">Aucun</option>
              {teacherOptions.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Niveau</label>
            <input className="input" value={level} onChange={(event) => setLevel(event.target.value)} placeholder="Kids, A2, TOEFL..." />
          </div>
          <div>
            <label style={labelStyle}>Statut</label>
            <select className="input" value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Enregistrement...' : studentClass ? 'Mettre à jour la classe' : 'Créer la classe'}
          </button>
        </form>
      </div>
    </div>
  )
}

function StudentModal({
  centerOptions,
  classOptions,
  student,
  memberships,
  onClose,
  onSaved,
}: {
  centerOptions: Center[]
  classOptions: StudentClass[]
  student?: Student | null
  memberships: StudentMembershipRow[]
  onClose: () => void
  onSaved: () => void
}) {
  const [fullName, setFullName] = useState(student?.full_name || '')
  const [centerId, setCenterId] = useState(student?.center_id || centerOptions[0]?.id || '')
  const [phone, setPhone] = useState(student?.phone || '')
  const [parentName, setParentName] = useState(student?.parent_name || '')
  const [parentPhone, setParentPhone] = useState(student?.parent_phone || '')
  const [email, setEmail] = useState(student?.email || '')
  const [paymentDueDate, setPaymentDueDate] = useState(student?.payment_due_date || '')
  const [accessStatus, setAccessStatus] = useState<'allowed' | 'blocked'>(student?.access_status || 'allowed')
  const [accessBlockReason, setAccessBlockReason] = useState(student?.access_block_reason || '')
  const [status, setStatus] = useState<'active' | 'inactive'>(student?.status || 'active')
  const [classIds, setClassIds] = useState<string[]>(memberships.map((membership) => membership.class_id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleClass = (classId: string) => {
    setClassIds((current) => current.includes(classId) ? current.filter((id) => id !== classId) : [...current, classId])
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      full_name: fullName,
      center_id: centerId || null,
      phone,
      parent_name: parentName,
      parent_phone: parentPhone,
      email,
      payment_due_date: paymentDueDate || null,
      access_status: accessStatus,
      access_block_reason: accessStatus === 'blocked' ? accessBlockReason : null,
      status,
      class_ids: classIds,
    }

    const result = student
      ? await updateStudent(student.id, payload)
      : await createStudent(payload)

    setSaving(false)
    if ('error' in result && result.error) {
      setError(result.error)
      return
    }

    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{student ? 'Modifier l’étudiant' : 'Ajouter un étudiant'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>
        {error ? <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: 12, marginBottom: '1rem' }}>{error}</div> : null}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div>
              <label style={labelStyle}>Nom complet</label>
              <input className="input" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Centre</label>
              <select className="input" value={centerId} onChange={(event) => setCenterId(event.target.value)}>
                <option value="">Aucun</option>
                {centerOptions.map((center) => (
                  <option key={center.id} value={center.id}>{center.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Téléphone étudiant</label>
              <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Nom du parent</label>
              <input className="input" value={parentName} onChange={(event) => setParentName(event.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Téléphone parent</label>
              <input className="input" value={parentPhone} onChange={(event) => setParentPhone(event.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Échéance paiement</label>
              <input className="input" type="date" value={paymentDueDate} onChange={(event) => setPaymentDueDate(event.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Statut étudiant</label>
              <select className="input" value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Accès signature</label>
              <select className="input" value={accessStatus} onChange={(event) => setAccessStatus(event.target.value as 'allowed' | 'blocked')}>
                <option value="allowed">Autorisé</option>
                <option value="blocked">Bloqué</option>
              </select>
            </div>
          </div>

          {accessStatus === 'blocked' ? (
            <div>
              <label style={labelStyle}>Raison interne du blocage</label>
              <input className="input" value={accessBlockReason} onChange={(event) => setAccessBlockReason(event.target.value)} placeholder="Paiement, dossier, suspension..." />
            </div>
          ) : null}

          <div>
            <label style={labelStyle}>Classes liées</label>
            <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {classOptions.map((studentClass) => {
                const checked = classIds.includes(studentClass.id)
                return (
                  <label
                    key={studentClass.id}
                    style={{
                      border: checked ? '1px solid #1d4ed8' : '1px solid var(--brand-border)',
                      background: checked ? 'rgba(59,130,246,0.08)' : 'white',
                      borderRadius: 14,
                      padding: '0.75rem',
                      display: 'flex',
                      gap: '0.6rem',
                      cursor: 'pointer',
                      alignItems: 'flex-start',
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleClass(studentClass.id)} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>{studentClass.name}</span>
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{studentClass.level || 'Sans niveau'}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Enregistrement...' : student ? 'Mettre à jour l’étudiant' : 'Créer l’étudiant'}
          </button>
        </form>
      </div>
    </div>
  )
}

function StudentPaymentModal({
  student,
  records,
  onClose,
  onSaved,
}: {
  student: Student
  records: StudentPaymentRecord[]
  onClose: () => void
  onSaved: () => void
}) {
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().split('T')[0])
  const [periodMonths, setPeriodMonths] = useState('3')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const result = await recordStudentPayment({
      student_id: student.id,
      paid_at: paidAt,
      period_months: Number(periodMonths) || 3,
      amount: amount ? Number(amount) : null,
      notes,
    })
    setSaving(false)

    if ('error' in result && result.error) {
      setError(result.error)
      return
    }

    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Paiement étudiant</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 800, color: 'var(--brand-navy)', fontSize: '1rem' }}>{student.full_name}</div>
          <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 4 }}>
            Prochaine échéance actuelle : {formatDate(student.payment_due_date)}
          </div>
        </div>

        {error ? <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: 12, marginBottom: '1rem' }}>{error}</div> : null}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem', marginBottom: '1.2rem' }}>
          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div>
              <label style={labelStyle}>Date de paiement</label>
              <input className="input" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Durée (mois)</label>
              <select className="input" value={periodMonths} onChange={(event) => setPeriodMonths(event.target.value)}>
                <option value="1">1 mois</option>
                <option value="3">3 mois</option>
                <option value="6">6 mois</option>
                <option value="12">12 mois</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Montant</label>
              <input className="input" type="number" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Note</label>
            <input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Espèces, virement, remarque..." />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer le paiement et renouveler'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--brand-border)', paddingTop: '1rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Historique</div>
          {records.length === 0 ? (
            <div className="brand-empty">Aucun paiement enregistré pour le moment.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {records.map((record) => (
                <div key={record.id} style={{ border: '1px solid var(--brand-border)', borderRadius: 14, padding: '0.8rem 0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>
                      {new Date(`${record.paid_at}T00:00:00`).toLocaleDateString('fr-FR')}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      Prochaine échéance : {formatDate(record.next_due_date)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.45rem', color: '#64748b', fontSize: '0.82rem' }}>
                    <span>{record.period_months} mois</span>
                    {record.amount !== null ? <span>{record.amount.toFixed(2)} MAD</span> : null}
                    {record.notes ? <span>{record.notes}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const labelStyle: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: '#374151',
  display: 'block',
  marginBottom: 4,
}
