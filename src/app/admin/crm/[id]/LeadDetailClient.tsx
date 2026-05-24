'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  addCrmLeadNote,
  convertCrmLeadToStudent,
  createCrmActivity,
  createCrmTask,
  deleteCrmLead,
  getCenters,
  getCrmActivities,
  getCrmAssignableUsers,
  getCrmLeadById,
  getCrmMessageTemplates,
  getCrmNotes,
  getCrmTasks,
  getRecommendedClassesForLead,
  updateCrmLead,
  updateCrmMessageTemplate,
  updateCrmTaskStatus,
} from '@/lib/actions'
import type { Center, CrmActivity, CrmLead, CrmMessageTemplate, CrmNote, CrmRecommendedClassMatch, CrmTask, Profile } from '@/lib/types'
import { CrmQuickActions } from '../components/CrmQuickActions'
import { LeadForm } from '../components/LeadForm'
import { CRM_STATUS_OPTIONS, CRM_STATUS_STYLES, formatDateTime } from '../components/crm-config'

export function LeadDetailClient({ leadId }: { leadId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [lead, setLead] = useState<CrmLead | null>(null)
  const [notes, setNotes] = useState<CrmNote[]>([])
  const [tasks, setTasks] = useState<CrmTask[]>([])
  const [activities, setActivities] = useState<CrmActivity[]>([])
  const [recommendedClasses, setRecommendedClasses] = useState<CrmRecommendedClassMatch[]>([])
  const [referenceNow, setReferenceNow] = useState<string | null>(null)
  const [centers, setCenters] = useState<Center[]>([])
  const [assignableUsers, setAssignableUsers] = useState<Profile[]>([])
  const [templates, setTemplates] = useState<CrmMessageTemplate[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDueAt, setTaskDueAt] = useState('')
  const [taskAssignee, setTaskAssignee] = useState('')
  const [converting, setConverting] = useState(false)
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null)
  const [deletingLead, setDeletingLead] = useState(false)
  const [loggingActivity, setLoggingActivity] = useState<string | null>(null)

  const loadData = async () => {
    const [leadData, notesData, tasksData, activityData, centerData, userData, templateData, recommendations] = await Promise.all([
      getCrmLeadById(leadId),
      getCrmNotes(leadId),
      getCrmTasks(leadId),
      getCrmActivities(leadId),
      getCenters(),
      getCrmAssignableUsers(),
      getCrmMessageTemplates(),
      getRecommendedClassesForLead(leadId),
    ])

    setLead(leadData)
    setNotes(notesData)
    setTasks(tasksData)
    setActivities(activityData)
    setCenters(centerData as Center[])
    setAssignableUsers(userData)
    setTemplates(templateData)
    setRecommendedClasses(recommendations)
    setTaskAssignee(leadData?.assigned_to || '')
    setReferenceNow(new Date().toISOString())
    setLoading(false)
  }

  useEffect(() => {
    let active = true

    async function bootstrap() {
      const [leadData, notesData, tasksData, activityData, centerData, userData, templateData, recommendations] = await Promise.all([
        getCrmLeadById(leadId),
        getCrmNotes(leadId),
        getCrmTasks(leadId),
        getCrmActivities(leadId),
        getCenters(),
        getCrmAssignableUsers(),
        getCrmMessageTemplates(),
        getRecommendedClassesForLead(leadId),
      ])

      if (!active) return

      setLead(leadData)
      setNotes(notesData)
      setTasks(tasksData)
      setActivities(activityData)
      setCenters(centerData as Center[])
      setAssignableUsers(userData)
      setTemplates(templateData)
      setRecommendedClasses(recommendations)
      setTaskAssignee(leadData?.assigned_to || '')
      setReferenceNow(new Date().toISOString())
      setLoading(false)
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [leadId])

  if (loading) {
    return <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Chargement...</div>
  }

  if (!lead) {
    return <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#b91c1c' }}>Prospect introuvable.</div>
  }

  const statusStyle = CRM_STATUS_STYLES[lead.status]

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 6 }}>
            <h1 style={{ fontSize: '1.55rem', fontWeight: 800 }}>{lead.parent_name}</h1>
            <span style={{ background: statusStyle.bg, color: statusStyle.text, padding: '0.3rem 0.65rem', borderRadius: 999, fontSize: '0.82rem', fontWeight: 700 }}>
              {CRM_STATUS_OPTIONS.find((option) => option.value === lead.status)?.label}
            </span>
          </div>
          <p style={{ color: '#64748b' }}>
            Étudiant : <strong>{lead.student_name}</strong> · Dernier contact : {formatDateTime(lead.last_contact_at)}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {lead.parent_whatsapp ? (
            <a className="btn btn-secondary" href={`https://wa.me/${lead.parent_whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          ) : null}
          {lead.parent_phone ? (
            <a className="btn btn-secondary" href={`tel:${lead.parent_phone}`}>Appeler</a>
          ) : null}
          {lead.converted_student_id ? (
            <Link href="/admin/students" className="btn btn-secondary">Voir l’étudiant</Link>
          ) : (
            <button
              className="btn btn-primary"
              disabled={converting}
              onClick={async () => {
                setConverting(true)
                const result = await convertCrmLeadToStudent(lead.id)
                setConverting(false)
                if (result.error) {
                  window.alert(result.error)
                  return
                }
                window.alert(`Prospect converti en étudiant (${result.studentId}).`)
                await loadData()
              }}
            >
              {converting ? 'Conversion...' : 'Convertir en étudiant'}
            </button>
          )}
          <button
            className="btn btn-secondary"
            style={{ borderColor: '#fecaca', color: '#b91c1c' }}
            disabled={deletingLead}
            onClick={async () => {
              const confirmation = window.prompt(`Pour supprimer définitivement le prospect "${lead.parent_name}", tapez SUPPRIMER`)
              if (confirmation !== 'SUPPRIMER') return

              setDeletingLead(true)
              const result = await deleteCrmLead(lead.id)
              setDeletingLead(false)

              if (result.error) {
                window.alert(result.error)
                return
              }

              router.push('/admin/crm')
            }}
          >
            {deletingLead ? 'Suppression...' : 'Supprimer le prospect'}
          </button>
        </div>
      </div>

      <div className="card">
        <LeadForm
          centers={centers}
          assignableUsers={assignableUsers}
          initialLead={lead}
          submitLabel="Enregistrer les modifications"
          onSubmit={async (values) => {
            const result = await updateCrmLead(lead.id, {
              center_id: values.center_id || null,
              assigned_to: values.assigned_to || null,
              parent_name: values.parent_name,
              parent_phone: values.parent_phone || null,
              parent_whatsapp: values.parent_whatsapp || null,
              parent_email: values.parent_email || null,
              audience: values.audience || null,
              student_name: values.student_name,
              student_age: values.student_age ? Number(values.student_age) : null,
              student_level: values.student_level || null,
              program_interest: values.program_interest || null,
              availability: values.availability || null,
              goal: values.goal || null,
              source: values.source || null,
              status: values.status,
              trial_date: values.trial_date ? new Date(values.trial_date).toISOString() : null,
              next_follow_up_at: values.next_follow_up_at ? new Date(values.next_follow_up_at).toISOString() : null,
              lost_reason: values.lost_reason || null,
              last_contact_at: new Date().toISOString(),
            })

            if (result.error) {
              window.alert(result.error)
              return
            }

            await loadData()
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', alignItems: 'start' }}>
        <div className="card" style={{ display: 'grid', gap: '1rem' }}>
          {lead.placement_test_completed_at ? (
            <div style={{ border: '1px solid #dbeafe', borderRadius: 18, background: '#eff6ff', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    English Quest
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    {lead.placement_test_badge || 'Badge'} · {lead.placement_test_level || 'Niveau'}
                  </div>
                </div>
                <div style={{ color: '#334155', fontSize: '0.9rem' }}>
                  Terminé le {formatDateTime(lead.placement_test_completed_at)}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                <QuestStat label="Score" value={lead.placement_test_score !== null ? `${lead.placement_test_score}%` : '—'} />
                <QuestStat label="XP" value={lead.placement_test_xp !== null ? `${lead.placement_test_xp} XP` : '—'} />
                <QuestStat label="Questions" value={lead.placement_test_total_questions !== null ? String(lead.placement_test_total_questions) : '—'} />
                <QuestStat label="Groupe conseillé" value={lead.placement_test_recommended_class || '—'} />
              </div>
            </div>
          ) : null}

          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 4 }}>Historique des notes</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Centralise les appels, visites et remarques commerciales.</p>
          </div>

          <form
            onSubmit={async (event) => {
              event.preventDefault()
              const result = await addCrmLeadNote(lead.id, noteDraft)
              if (result.error) {
                window.alert(result.error)
                return
              }
              setNoteDraft('')
              await loadData()
            }}
            style={{ display: 'grid', gap: '0.75rem' }}
          >
            <textarea
              className="input"
              rows={4}
              placeholder="Ajouter une note de suivi..."
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" type="submit">Ajouter la note</button>
            </div>
          </form>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {notes.length === 0 ? (
              <div style={{ color: '#64748b' }}>Aucune note pour le moment.</div>
            ) : notes.map((note) => (
              <div key={note.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: '0.9rem 1rem', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: 8 }}>
                  <strong>{note.author?.full_name || 'Administration'}</strong>
                  <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{formatDateTime(note.created_at)}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', color: '#334155' }}>{note.note}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 4 }}>Communication rapide</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>WhatsApp, appel et messages préremplis pour la réception.</p>
          </div>

          <CrmQuickActions lead={lead} templates={templates} />

          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={loggingActivity === 'call'}
              onClick={async () => {
                setLoggingActivity('call')
                const result = await createCrmActivity({ lead_id: lead.id, activity_type: 'call' })
                setLoggingActivity(null)
                if (result.error) {
                  window.alert(result.error)
                  return
                }
                await loadData()
              }}
            >
              {loggingActivity === 'call' ? 'Journalisation...' : 'Journaliser appel'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={loggingActivity === 'whatsapp'}
              onClick={async () => {
                setLoggingActivity('whatsapp')
                const result = await createCrmActivity({ lead_id: lead.id, activity_type: 'whatsapp' })
                setLoggingActivity(null)
                if (result.error) {
                  window.alert(result.error)
                  return
                }
                await loadData()
              }}
            >
              {loggingActivity === 'whatsapp' ? 'Journalisation...' : 'Journaliser WhatsApp'}
            </button>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0' }} />

          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 4 }}>Classes recommandées</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Suggestions automatiques basées sur le niveau, l’âge et la disponibilité.</p>
          </div>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {recommendedClasses.length === 0 ? (
              <div style={{ color: '#64748b' }}>Aucune classe recommandée pour le moment.</div>
            ) : recommendedClasses.map((entry) => (
              <div key={entry.class_id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: '0.9rem 1rem', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: 6 }}>
                  <strong>{entry.class_name}</strong>
                  <span style={{ color: '#0f766e', fontWeight: 800 }}>{entry.score} pts</span>
                </div>
                <div style={{ color: '#334155', fontSize: '0.9rem', marginBottom: 6 }}>
                  Niveau {entry.level || '—'} · Audience {entry.audience || '—'}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.84rem', marginBottom: 6 }}>
                  Prochaine séance : {formatDateTime(entry.next_session_at)}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.84rem' }}>
                  {entry.rationale.join(' · ')}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0' }} />

          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 4 }}>Modèles de relance</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Modifie les messages WhatsApp utilisés dans tout le CRM.</p>
          </div>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {templates.map((template) => (
              <TemplateEditorCard
                key={template.id}
                template={template}
                saving={savingTemplateId === template.id}
                onSave={async (nextTemplate) => {
                  setSavingTemplateId(template.id)
                  const result = await updateCrmMessageTemplate(template.id, nextTemplate)
                  setSavingTemplateId(null)
                  if (result.error) {
                    window.alert(result.error)
                    return
                  }
                  await loadData()
                }}
              />
            ))}
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0' }} />

          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 4 }}>Relances</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Planifie les prochains appels et tests de niveau.</p>
          </div>

          <form
            onSubmit={async (event) => {
              event.preventDefault()
              if (!taskTitle.trim() || !taskDueAt) {
                window.alert('Titre et échéance obligatoires.')
                return
              }
              const result = await createCrmTask({
                lead_id: lead.id,
                title: taskTitle,
                due_at: new Date(taskDueAt).toISOString(),
                assigned_to: taskAssignee || null,
              })
              if (result.error) {
                window.alert(result.error)
                return
              }
              setTaskTitle('')
              setTaskDueAt('')
              await loadData()
            }}
            style={{ display: 'grid', gap: '0.75rem' }}
          >
            <input className="input" placeholder="Titre de relance" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
            <input className="input" type="datetime-local" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} />
            <select className="input" value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)}>
              <option value="">Non assigné</option>
              {assignableUsers.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.full_name || profile.email || profile.id}</option>
              ))}
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" type="submit">Ajouter la relance</button>
            </div>
          </form>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {tasks.length === 0 ? (
              <div style={{ color: '#64748b' }}>Aucune relance planifiée.</div>
            ) : tasks.map((task) => {
              const overdue = referenceNow != null && task.status === 'pending' && new Date(task.due_at).getTime() < new Date(referenceNow).getTime()
              return (
                <div key={task.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: '0.9rem 1rem', background: overdue ? '#fff7ed' : '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: 6 }}>
                    <strong>{task.title}</strong>
                    <span style={{ color: overdue ? '#c2410c' : '#64748b', fontSize: '0.82rem', fontWeight: 700 }}>
                      {task.status === 'completed' ? 'Terminée' : overdue ? 'En retard' : 'À faire'}
                    </span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: 10 }}>
                    {formatDateTime(task.due_at)} · {task.assignee?.full_name || 'Non assigné'}
                  </div>
                  {task.status !== 'completed' ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        const result = await updateCrmTaskStatus(task.id, 'completed')
                        if (result.error) {
                          window.alert(result.error)
                          return
                        }
                        await loadData()
                      }}
                    >
                      Marquer comme faite
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>

          {lead.converted_student_id ? (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', color: '#0f766e', fontWeight: 700 }}>
              Prospect déjà converti en étudiant.
            </div>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 4 }}>CRM activity timeline</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Historique propre des événements automatiques et manuels sur ce prospect.</p>
        </div>

        <div style={{ display: 'grid', gap: '0.9rem' }}>
          {activities.length === 0 ? (
            <div style={{ color: '#64748b' }}>Aucune activité CRM enregistrée.</div>
          ) : activities.map((activity) => (
            <div key={activity.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1rem', alignItems: 'start' }}>
              <div style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 700 }}>
                {new Date(activity.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
              </div>
              <div style={{ borderLeft: '2px solid #e2e8f0', paddingLeft: '1rem', paddingBottom: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: 4 }}>
                  <strong>{activity.title}</strong>
                  <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{formatDateTime(activity.created_at)}</span>
                </div>
                {activity.detail ? (
                  <div style={{ color: '#334155', marginBottom: 4 }}>{activity.detail}</div>
                ) : null}
                <div style={{ color: '#64748b', fontSize: '0.82rem' }}>
                  {activity.actor?.full_name || 'Système'} · {formatActivityType(activity.activity_type)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function QuestStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 14, background: '#fff', border: '1px solid #dbeafe', padding: '0.8rem 0.9rem' }}>
      <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#0f172a', fontWeight: 800 }}>{value}</div>
    </div>
  )
}

function TemplateEditorCard({
  template,
  saving,
  onSave,
}: {
  template: CrmMessageTemplate
  saving: boolean
  onSave: (payload: {
    name: string
    message_type: CrmMessageTemplate['message_type']
    message_body: string
    is_active: boolean
  }) => Promise<void>
}) {
  const [name, setName] = useState(template.name)
  const [messageType, setMessageType] = useState<CrmMessageTemplate['message_type']>(template.message_type)
  const [messageBody, setMessageBody] = useState(template.message_body)
  const [isActive, setIsActive] = useState(template.is_active)

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: '0.9rem 1rem', background: '#fff', display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '0.75rem' }}>
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
        <select className="input" value={messageType} onChange={(event) => setMessageType(event.target.value as CrmMessageTemplate['message_type'])}>
          <option value="first_contact">Premier contact</option>
          <option value="follow_up">Relance</option>
          <option value="trial_invite">Invitation test</option>
          <option value="trial_reminder">Rappel test</option>
        </select>
      </div>
      <textarea className="input" rows={5} value={messageBody} onChange={(event) => setMessageBody(event.target.value)} />
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#334155', fontSize: '0.9rem' }}>
        <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
        Modèle actif
      </label>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={saving}
          onClick={async () => {
            await onSave({
              name,
              message_type: messageType,
              message_body: messageBody,
              is_active: isActive,
            })
          }}
        >
          {saving ? 'Enregistrement...' : 'Enregistrer le modèle'}
        </button>
      </div>
    </div>
  )
}

function formatActivityType(value: CrmActivity['activity_type']) {
  const labels: Record<CrmActivity['activity_type'], string> = {
    call: 'Appel',
    whatsapp: 'WhatsApp',
    note: 'Note',
    test_completed: 'Test terminé',
    trial_scheduled: 'Essai planifié',
    payment_followup: 'Suivi paiement',
    status_change: 'Changement de statut',
    enrollment: 'Inscription',
    telegram_alert: 'Alerte Telegram',
    follow_up_reminder: 'Relance',
    class_recommendation: 'Classe recommandée',
  }

  return labels[value]
}
