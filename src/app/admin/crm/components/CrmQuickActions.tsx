'use client'

import { useMemo, useState } from 'react'
import type { CrmLead, CrmMessageTemplate } from '@/lib/types'

type CrmQuickActionsProps = {
  lead: Pick<CrmLead, 'parent_name' | 'parent_phone' | 'parent_whatsapp' | 'student_name' | 'program_interest' | 'availability'>
  templates: CrmMessageTemplate[]
  compact?: boolean
}

function fillTemplate(template: string, lead: CrmQuickActionsProps['lead']) {
  return template
    .replaceAll('{{parent_name}}', lead.parent_name || '')
    .replaceAll('{{student_name}}', lead.student_name || '')
    .replaceAll('{{program_interest}}', lead.program_interest || 'nos cours')
    .replaceAll('{{availability}}', lead.availability || 'cette semaine')
}

export function CrmQuickActions({ lead, templates, compact = false }: CrmQuickActionsProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || '')
  const [customMessage, setCustomMessage] = useState('')
  const [copied, setCopied] = useState(false)

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || templates[0] || null,
    [selectedTemplateId, templates]
  )

  const generatedMessage = selectedTemplate ? fillTemplate(selectedTemplate.message_body, lead) : ''
  const message = customMessage || generatedMessage
  const whatsappHref = lead.parent_whatsapp
    ? `https://wa.me/${lead.parent_whatsapp.replace(/\D/g, '')}${message ? `?text=${encodeURIComponent(message)}` : ''}`
    : null

  return (
    <div style={{ display: 'grid', gap: compact ? '0.5rem' : '0.75rem' }}>
      {templates.length > 0 ? (
        <select
          className="input"
          value={selectedTemplateId}
          onChange={(event) => {
            setSelectedTemplateId(event.target.value)
            setCustomMessage('')
          }}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>{template.name}</option>
          ))}
        </select>
      ) : null}

      {!compact && message ? (
        <textarea
          className="input"
          rows={5}
          value={message}
          onChange={(event) => setCustomMessage(event.target.value)}
        />
      ) : null}

      <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
        {lead.parent_phone ? (
          <a className="btn btn-secondary btn-sm" href={`tel:${lead.parent_phone}`}>Appeler</a>
        ) : null}
        {whatsappHref ? (
          <a className="btn btn-secondary btn-sm" href={whatsappHref} target="_blank" rel="noreferrer">WhatsApp</a>
        ) : null}
        {message ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              await navigator.clipboard.writeText(message)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? 'Copié' : 'Copier message'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
