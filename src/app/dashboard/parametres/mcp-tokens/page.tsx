'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Plus, Trash2, Power, Key, Brain, Terminal, Cpu, Bot, Cloud } from 'lucide-react'
import { listMcpTokens, generateMcpToken, revokeMcpToken, deleteMcpToken } from '@/lib/actions'
import type { McpToken } from '@/lib/actions'

const configs = [
  {
    id: 'claude', name: 'Claude Desktop', icon: Brain,
    config: `{
  "mcpServers": {
    "profcheck": {
      "command": "node",
      "args": ["mcp-server.js"],
      "env": {
        "MCP_TOKEN": "___TOKEN___"
      }
    }
  }
}`,
    file: 'claude_desktop_config.json',
  },
  {
    id: 'cursor', name: 'Cursor', icon: Terminal,
    config: `{
  "mcpServers": {
    "profcheck": {
      "command": "node",
      "args": ["mcp-server.js"],
      "env": {
        "MCP_TOKEN": "___TOKEN___"
      }
    }
  }
}`,
    file: '.cursor/mcp.json',
  },
  {
    id: 'codex', name: 'Codex', icon: Cpu,
    config: `[mcp_servers.profcheck]
command = "node"
args = ["mcp-server.js"]
env = { MCP_TOKEN = "___TOKEN___" }
enabled = true`,
    file: '.codex/config.toml',
  },
  {
    id: 'chatgpt', name: 'ChatGPT', icon: Bot,
    config: `// Custom GPT Action
// Add MCP_TOKEN as env variable
// in your GPT configuration:
// MCP_TOKEN=___TOKEN___`,
    file: 'GPT Configuration',
  },
  {
    id: 'generic', name: 'Autre outil', icon: Cloud,
    config: `# Configuration générique
# Variables d'environnement requises :
MCP_TOKEN=___TOKEN___`,
    file: '.env',
  },
] as const

export default function McpTokensPage() {
  const [tokens, setTokens] = useState<McpToken[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [active, setActive] = useState('claude')

  const load = async () => {
    setLoading(true)
    const result = await listMcpTokens()
    setTokens(result)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setGenerating(true)
    setNewTokenValue(null)
    const name = (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value
    const result = await generateMcpToken(name || 'default')
    setGenerating(false)
    if (result.data) {
      setNewTokenValue(result.data.token)
      await load()
    }
  }

  const handleRevoke = async (id: string) => {
    await revokeMcpToken(id)
    await load()
  }

  const handleDelete = async (id: string) => {
    await deleteMcpToken(id)
    await load()
  }

  const copy = (value: string) => {
    navigator.clipboard.writeText(value)
    setCopied(value)
    setTimeout(() => setCopied(null), 2000)
  }

  const current = configs.find((c) => c.id === active)!
  const activeTokens = tokens.filter((t) => t.is_active)
  const defaultToken = activeTokens[0]?.token || '___TOKEN___'
  const configText = current.config.replace('___TOKEN___', defaultToken)

  return (
    <div className="page-enter">
      <div className="brand-page-header">
        <h1 className="brand-page-title">Clés MCP</h1>
        <p className="brand-page-subtitle">
          Gérez vos tokens et configurez vos assistants IA directement ici.
        </p>
      </div>

      {newTokenValue && (
        <div
          className="mb-6 rounded-2xl p-5"
          style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}
        >
          <div className="mb-2 text-sm font-bold" style={{ color: '#065f46' }}>
            Nouveau token généré — copiez-le maintenant, il ne sera plus jamais affiché
          </div>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 rounded-xl px-4 py-3 text-sm font-mono"
              style={{ background: '#fff', border: '1px solid var(--brand-border)', color: 'var(--brand-navy)' }}
            >
              {newTokenValue}
            </code>
            <button onClick={() => copy(newTokenValue)} className="btn btn-sm btn-secondary">
              {copied === newTokenValue ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}

      <div className="brand-card brand-card-pad mb-6">
        <form onSubmit={handleGenerate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-sm font-bold" style={{ color: 'var(--brand-navy)' }} htmlFor="name">
              Nom du token
            </label>
            <input
              id="name"
              name="name"
              className="input mt-1"
              placeholder="ex: Claude Desktop, Cursor..."
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={generating}>
            <Plus size={16} />
            {generating ? 'Génération...' : 'Générer un token'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="brand-card flex items-center justify-center py-12 text-sm" style={{ color: 'var(--brand-muted)' }}>
          Chargement...
        </div>
      ) : tokens.length === 0 ? (
        <div className="brand-card flex items-center justify-center py-12 text-sm" style={{ color: 'var(--brand-muted)' }}>
          Aucun token. Créez-en un pour connecter vos outils IA.
        </div>
      ) : (
        <div className="brand-card overflow-hidden mb-8">
          {tokens.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 px-5 py-4"
              style={{ borderBottom: '1px solid var(--brand-border)' }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: t.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
                  color: t.is_active ? '#065f46' : '#94a3b8',
                }}
              >
                <Key size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: 'var(--brand-navy)' }}>
                    {t.name}
                  </span>
                  {t.is_active ? (
                    <span className="brand-mini-badge emerald">Actif</span>
                  ) : (
                    <span className="brand-mini-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                      Révoqué
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs" style={{ color: 'var(--brand-muted)' }}>
                  Créé le {new Date(t.created_at).toLocaleDateString('fr-FR')}
                  {t.last_used_at && ` · Dernière utilisation : ${new Date(t.last_used_at).toLocaleDateString('fr-FR')}`}
                </div>
              </div>
              <button onClick={() => copy(t.token)} className="btn btn-sm btn-secondary" title="Copier">
                {copied === t.token ? <Check size={14} /> : <Copy size={14} />}
              </button>
              {t.is_active && (
                <button
                  onClick={() => handleRevoke(t.id)}
                  className="btn btn-sm"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#92400e', border: '1px solid rgba(245,158,11,0.2)' }}
                  title="Révoquer"
                >
                  <Power size={14} />
                </button>
              )}
              <button
                onClick={() => handleDelete(t.id)}
                className="btn btn-sm"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#991b1b', border: '1px solid rgba(239,68,68,0.15)' }}
                title="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─── CONFIG GUIDE ──────────────────── */}
      <h2 className="text-base font-bold mb-4" style={{ color: 'var(--brand-navy)' }}>
        Configuration par outil
      </h2>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3">
        {configs.map((c) => {
          const Icon = c.icon
          const isActive = active === c.id
          return (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className="flex flex-col items-center gap-2 rounded-2xl p-4 text-center text-sm font-semibold transition-all"
              style={{
                background: isActive ? 'var(--brand-gold-soft)' : 'rgba(255,255,255,0.7)',
                border: `1px solid ${isActive ? 'var(--brand-gold)' : 'var(--brand-border)'}`,
                color: isActive ? 'var(--brand-navy)' : 'var(--brand-muted)',
              }}
            >
              <Icon size={22} style={{ color: isActive ? 'var(--brand-gold)' : 'var(--brand-subtle)' }} />
              <span>{c.name}</span>
            </button>
          )
        })}
      </div>

      <div className="brand-card overflow-hidden mb-6">
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--brand-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: 'var(--brand-navy)' }}>
              {active === 'claude' ? 'C' : active === 'cursor' ? 'Cu' : active === 'codex' ? 'Co' : active === 'chatgpt' ? 'G' : 'M'}
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--brand-navy)' }}>{current.name}</div>
              <div className="text-xs" style={{ color: 'var(--brand-muted)' }}>{current.file}</div>
            </div>
          </div>
          <button onClick={() => copy(configText)} className="btn btn-sm btn-secondary">
            {copied === 'config' ? <Check size={14} style={{ color: 'var(--color-success)' }} /> : <Copy size={14} />}
            {copied === 'config' ? 'Copié' : 'Copier'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <pre className="p-5 text-sm leading-relaxed" style={{ background: 'var(--brand-paper)', color: 'var(--brand-navy)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.8125rem' }}>
            <code>{configText}</code>
          </pre>
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: 'var(--brand-gold-soft)', border: '1px solid rgba(201,168,76,0.25)' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--brand-navy)' }}>Prêt à démarrer ?</h3>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--brand-muted)' }}>
          1. Générez un token ci-dessus<br />
          2. Copiez la configuration de votre outil<br />
          3. Remplacez <code className="rounded bg-white/60 px-1.5 py-0.5 text-xs font-mono" style={{ color: 'var(--brand-navy)' }}>___TOKEN___</code> par votre token<br />
          4. Lancez votre assistant IA
        </p>
      </div>
    </div>
  )
}
