'use client'

import { useState } from 'react'
import type { Center, CrmLead, Profile } from '@/lib/types'
import { CRM_STATUS_OPTIONS, toDateTimeLocalValue } from './crm-config'

type LeadFormValues = {
  center_id: string
  assigned_to: string
  parent_name: string
  parent_phone: string
  parent_whatsapp: string
  parent_email: string
  audience: '' | 'junior' | 'adult'
  student_name: string
  student_age: string
  student_level: string
  program_interest: string
  availability: string
  goal: string
  source: string
  status: CrmLead['status']
  trial_date: string
  next_follow_up_at: string
  lost_reason: string
}

type LeadFormProps = {
  centers: Center[]
  assignableUsers: Profile[]
  initialLead?: CrmLead | null
  submitLabel: string
  onSubmit: (values: LeadFormValues) => Promise<void>
}

export function LeadForm({ centers, assignableUsers, initialLead, submitLabel, onSubmit }: LeadFormProps) {
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<LeadFormValues>({
    center_id: initialLead?.center_id || '',
    assigned_to: initialLead?.assigned_to || '',
    parent_name: initialLead?.parent_name || '',
    parent_phone: initialLead?.parent_phone || '',
    parent_whatsapp: initialLead?.parent_whatsapp || '',
    parent_email: initialLead?.parent_email || '',
    audience: initialLead?.audience || '',
    student_name: initialLead?.student_name || '',
    student_age: initialLead?.student_age ? String(initialLead.student_age) : '',
    student_level: initialLead?.student_level || '',
    program_interest: initialLead?.program_interest || '',
    availability: initialLead?.availability || '',
    goal: initialLead?.goal || '',
    source: initialLead?.source || '',
    status: initialLead?.status || 'new',
    trial_date: toDateTimeLocalValue(initialLead?.trial_date),
    next_follow_up_at: toDateTimeLocalValue(initialLead?.next_follow_up_at),
    lost_reason: initialLead?.lost_reason || '',
  })

  const handleChange = (key: keyof LeadFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        setSaving(true)
        await onSubmit(values)
        setSaving(false)
      }}
      style={{ display: 'grid', gap: '1rem' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <Field label="Centre">
          <select className="input" value={values.center_id} onChange={(event) => handleChange('center_id', event.target.value)}>
            <option value="">Aucun centre</option>
            {centers.map((center) => (
              <option key={center.id} value={center.id}>{center.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Assigné à">
          <select className="input" value={values.assigned_to} onChange={(event) => handleChange('assigned_to', event.target.value)}>
            <option value="">Non assigné</option>
            {assignableUsers.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.full_name || profile.email || profile.id}</option>
            ))}
          </select>
        </Field>
        <Field label="Statut">
          <select className="input" value={values.status} onChange={(event) => handleChange('status', event.target.value)}>
            {CRM_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Parcours">
          <select className="input" value={values.audience} onChange={(event) => handleChange('audience', event.target.value as LeadFormValues['audience'])}>
            <option value="">Non précisé</option>
            <option value="adult">Adult</option>
            <option value="junior">Junior</option>
          </select>
        </Field>
        <Field label="Relance prévue">
          <input
            className="input"
            type="datetime-local"
            value={values.next_follow_up_at}
            onChange={(event) => handleChange('next_follow_up_at', event.target.value)}
          />
        </Field>
        <Field label="Date du test">
          <input
            className="input"
            type="datetime-local"
            value={values.trial_date}
            onChange={(event) => handleChange('trial_date', event.target.value)}
          />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <Field label="Nom du parent *">
          <input className="input" value={values.parent_name} onChange={(event) => handleChange('parent_name', event.target.value)} required />
        </Field>
        <Field label="Téléphone parent">
          <input className="input" value={values.parent_phone} onChange={(event) => handleChange('parent_phone', event.target.value)} />
        </Field>
        <Field label="WhatsApp parent">
          <input className="input" value={values.parent_whatsapp} onChange={(event) => handleChange('parent_whatsapp', event.target.value)} />
        </Field>
        <Field label="Email parent">
          <input className="input" type="email" value={values.parent_email} onChange={(event) => handleChange('parent_email', event.target.value)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <Field label="Nom de l'étudiant *">
          <input className="input" value={values.student_name} onChange={(event) => handleChange('student_name', event.target.value)} required />
        </Field>
        <Field label="Âge">
          <input className="input" type="number" min="3" max="99" value={values.student_age} onChange={(event) => handleChange('student_age', event.target.value)} />
        </Field>
        <Field label="Niveau">
          <input className="input" value={values.student_level} onChange={(event) => handleChange('student_level', event.target.value)} />
        </Field>
        <Field label="Programme demandé">
          <input className="input" value={values.program_interest} onChange={(event) => handleChange('program_interest', event.target.value)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <Field label="Disponibilités">
          <input className="input" value={values.availability} onChange={(event) => handleChange('availability', event.target.value)} />
        </Field>
        <Field label="Objectif">
          <input className="input" value={values.goal} onChange={(event) => handleChange('goal', event.target.value)} />
        </Field>
        <Field label="Source">
          <input className="input" value={values.source} onChange={(event) => handleChange('source', event.target.value)} />
        </Field>
        <Field label="Motif de perte">
          <input className="input" value={values.lost_reason} onChange={(event) => handleChange('lost_reason', event.target.value)} />
        </Field>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem', color: '#334155' }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      {children}
    </label>
  )
}
