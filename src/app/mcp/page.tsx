'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Plus, Power, Trash2, Key, Shield, BookOpen, ChevronLeft } from 'lucide-react'
import { listMcpTokens, generateMcpToken, revokeMcpToken, deleteMcpToken } from '@/lib/actions'
import type { McpToken } from '@/lib/actions'

const configs = [
  {
    id: 'claude', name: 'Claude Desktop', short: 'C',
    file: '~/Library/Application Support/Claude/claude_desktop_config.json',
    lang: 'JSON',
    code: `{
  "mcpServers": {
    "profcheck": {
      "command": "node",
      "args": ["mcp-server.js"],
      "env": {
        "MCP_TOKEN": "___TOKEN___",
        "MCP_URL": "https://profcheck.vercel.app/mcp"
      }
    }
  }
}`,
    note: 'Ouvrez ce fichier avec Fichier → Ouvrir la configuration dans Claude Desktop, ou naviguez manuellement vers le chemin indiqué. Remplacez ___TOKEN___ par votre token généré ci-dessus.',
  },
  {
    id: 'cursor', name: 'Cursor', short: 'Cu',
    file: '.cursor/mcp.json',
    lang: 'JSON',
    code: `{
  "mcpServers": {
    "profcheck": {
      "url": "https://profcheck.vercel.app/mcp",
      "headers": {
        "Authorization": "Bearer ___TOKEN___"
      }
    }
  }
}`,
    note: 'Créez ce fichier à la racine de votre projet Cursor. Remplacez ___TOKEN___ par votre token.',
  },
  {
    id: 'codex', name: 'Codex', short: 'Co',
    file: 'codex.yaml',
    lang: 'YAML',
    code: `mcp_servers:
  profcheck:
    url: https://profcheck.vercel.app/mcp
    auth:
      type: bearer
      token: ___TOKEN___`,
    note: 'Placez ce fichier à la racine du projet et remplacez ___TOKEN___.',
  },
  {
    id: 'chatgpt', name: 'ChatGPT', short: 'G',
    file: 'openapi.json',
    lang: 'JSON',
    code: `{
  "schema_version": "v1",
  "name_for_human": "ProfCheck",
  "api": {
    "type": "openapi",
    "url": "https://profcheck.vercel.app/openapi.json"
  },
  "auth": {
    "type": "user_http",
    "authorization_type": "bearer"
  }
}`,
    note: 'Dans ChatGPT → Explore GPTs → Create → Configure → Add Action, collez l\'URL : https://profcheck.vercel.app/openapi.json. Lors de la première utilisation, ChatGPT vous demandera votre token MCP — copiez-le depuis la section ci-dessus.',
  },
  {
    id: 'other', name: 'Autre outil', short: 'M',
    file: 'Endpoint HTTP direct',
    lang: 'HTTP',
    code: `# URL du serveur MCP
https://profcheck.vercel.app/mcp

# Header d'authentification
Authorization: Bearer ___TOKEN___

# Lister les outils disponibles
POST /mcp
{ "method": "tools/list" }

# Appeler un outil
POST /mcp
{
  "method": "tools/call",
  "params": {
    "name": "list_teachers",
    "arguments": {}
  }
}`,
    note: '',
  },
] as const

const capabilities = [
  { label: "Lister les professeurs", desc: "Consultez tous les profs, leurs sessions et taux de présence.", color: 'navy' },
  { label: "Consulter les pointages", desc: "Sessions actives, historique des présences, absences du jour.", color: 'green' },
  { label: "Gérer le planning", desc: "Créez et modifiez les séances planifiées, vérifiez les conflits.", color: 'gold' },
  { label: "Suivre le CRM", desc: "Prospects, pipeline, activités et notes de suivi des étudiants.", color: 'navy' },
  { label: "Créer des entités", desc: "Ajoutez des professeurs, étudiants, salles et centres.", color: 'red' },
  { label: "Requêtes sur mesure", desc: "Exécutez des requêtes Supabase personnalisées en langage naturel.", color: 'green' },
]

const steps = [
  { title: "Générez un token", desc: 'Cliquez sur "Nouveau token" en haut de cette page. Copiez-le immédiatement — il ne sera plus affiché.' },
  { title: "Copiez la configuration", desc: "Sélectionnez votre outil (Claude Desktop, Cursor, etc.) et copiez le bloc de configuration ci-dessus." },
  { title: "Remplacez ___TOKEN___", desc: "Dans la configuration copiée, remplacez ___TOKEN___ par votre token personnel généré à l'étape 1." },
  { title: "Lancez votre assistant IA", desc: 'Redémarrez votre outil IA. ProfCheck apparaît automatiquement dans les outils disponibles. Dites : "Montre-moi les absences d\'aujourd\'hui"' },
]

function showToast(msg: string) {
  const el = document.getElementById('mcp-toast')
  const msgEl = document.getElementById('mcp-toast-msg')
  if (!el || !msgEl) return
  msgEl.textContent = msg
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 2800)
}

export default function McpPage() {
  const [active, setActive] = useState('claude')
  const [copied, setCopied] = useState<string | null>(null)
  const [tokens, setTokens] = useState<McpToken[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null)

  const loadTokens = async () => {
    setLoading(true)
    const result = await listMcpTokens()
    setTokens(result)
    setLoading(false)
  }

  useEffect(() => {
    loadTokens()
  }, [])

  const current = configs.find((c) => c.id === active)!
  const activeTokens = tokens.filter((t) => t.is_active)
  const defaultToken = activeTokens[0]?.token || '___TOKEN___'
  const configText = current.code.replace('___TOKEN___', defaultToken)

  const copyConfig = async () => {
    await navigator.clipboard.writeText(configText)
    setCopied('config')
    showToast('Configuration copiée')
    setTimeout(() => setCopied(null), 2000)
  }

  const copyText = (value: string, key: string) => {
    navigator.clipboard.writeText(value)
    setCopied(key)
    if (key === 'new') showToast('Token copié dans le presse-papier')
    setTimeout(() => setCopied(null), 2000)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setNewTokenValue(null)
    const result = await generateMcpToken('MCP Web')
    setGenerating(false)
    if (result.data) {
      setNewTokenValue(result.data.token)
      showToast('Token généré — copiez-le maintenant !')
      await loadTokens()
    }
  }

  const handleRevoke = async (id: string) => {
    await revokeMcpToken(id)
    await loadTokens()
  }

  const handleDelete = async (id: string) => {
    await deleteMcpToken(id)
    await loadTokens()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF6EE', color: '#0F1F4C', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:none; } }
        @keyframes slideIn { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:none; } }
        @keyframes glow { 0%,100% { box-shadow:0 0 12px #E8B923; } 50% { box-shadow:0 0 28px #E8B923, 0 0 6px #fff; } }
        .anim-1 { animation: fadeUp .7s .1s both cubic-bezier(.16,1,.3,1); }
        .anim-2 { animation: fadeUp .7s .22s both cubic-bezier(.16,1,.3,1); }
        .anim-3 { animation: fadeUp .7s .34s both cubic-bezier(.16,1,.3,1); }
        .anim-4 { animation: fadeUp .7s .46s both cubic-bezier(.16,1,.3,1); }
        .anim-5 { animation: fadeUp .7s .58s both cubic-bezier(.16,1,.3,1); }
        @keyframes shimmer { 0%,100% { transform:translateX(-100%); } 50% { transform:translateX(100%); } }
        .btn-new-token { position:relative; overflow:hidden; }
        .btn-new-token::before { content:''; position:absolute; inset:0; background:linear-gradient(120deg,transparent,rgba(232,185,35,.25),transparent); transform:translateX(-100%); transition:transform .6s; }
        .btn-new-token:hover::before { transform:translateX(100%); }
        .btn-new-token::after { content:''; position:absolute; bottom:0; left:0; right:0; height:2px; background:#E8B923; transform:scaleX(0); transform-origin:left; transition:transform .35s; }
        .btn-new-token:hover::after { transform:scaleX(1); }
        .toast-mcp { position:fixed; bottom:1.5rem; right:1.5rem; z-index:999; background:#0F1F4C; color:#fff; padding:10px 18px; border-radius:10px; font-size:.83rem; font-weight:500; display:flex; align-items:center; gap:8px; box-shadow:0 8px 24px rgba(15,31,76,.3); transform:translateY(80px); opacity:0; transition:transform .35s cubic-bezier(.16,1,.3,1), opacity .35s; pointer-events:none; }
        .toast-mcp.show { transform:none; opacity:1; }
        .toast-dot { width:7px; height:7px; border-radius:50%; background:#E8B923; }
      `}</style>

      {/* ─── TOP BAR ─────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(250,246,238,.88)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(15,31,76,0.10)',
        padding: '0 2rem', height: 58,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, background: '#0F1F4C', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path d="M9 12l2 2 4-4" stroke="#E8B923" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 2L3 7v6c0 5 3.5 9.5 9 11 5.5-1.5 9-6 9-11V7l-9-5z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: '.9rem', fontWeight: 600, color: '#0F1F4C' }}>
            ProfCheck <span style={{ color: '#C49A1A', fontWeight: 500 }}>/ Cambridge Campus</span>
          </span>
          <span style={{
            background: 'rgba(232,185,35,0.12)', border: '1px solid rgba(232,185,35,.25)',
            color: '#C49A1A', fontSize: '.65rem', fontWeight: 600,
            letterSpacing: '.08em', textTransform: 'uppercase',
            padding: '3px 10px', borderRadius: 999,
          }}>MCP</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/dashboard" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#0F1F4C', color: '#fff', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '.8rem', fontWeight: 600,
            padding: '7px 16px', borderRadius: 10, textDecoration: 'none',
          }}>
            <ChevronLeft size={14} /> Dashboard
          </a>
        </div>
      </nav>

      {/* ─── HERO ────────────────── */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '4.5rem 2rem 0', textAlign: 'center' }}>
        <div className="anim-1">
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#fff', border: '1px solid rgba(232,185,35,.3)',
            borderRadius: 999, padding: '5px 14px',
            fontSize: '.7rem', fontWeight: 600, letterSpacing: '.1em',
            textTransform: 'uppercase', color: '#C49A1A', marginBottom: '1.5rem',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E8B923', animation: 'glow 2s ease-in-out infinite' }}></span>
            Connecteur IA officiel
          </div>
        </div>
        <h1 className="anim-2" style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', fontWeight: 800, color: '#0F1F4C',
          lineHeight: 1.08, letterSpacing: '-.03em', marginBottom: '1.25rem',
        }}>
          Connectez ProfCheck<br/>à votre <em style={{ fontStyle: 'italic', color: '#C49A1A' }}>assistant IA</em>
        </h1>
        <p className="anim-3" style={{ fontSize: '1.05rem', color: '#6B7A99', lineHeight: 1.65, maxWidth: 560, margin: '0 auto 2.5rem' }}>
          Utilisez votre token personnel pour connecter Claude, Cursor, Codex ou tout outil compatible MCP.
          Chaque utilisateur dispose de son propre accès — révocable à tout moment.
        </p>
      </section>

      {/* ─── BODY ────────────────── */}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '0 2rem 6rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ─── TOKEN CARD ──────────── */}
        <div className="anim-3" style={{ background: '#fff', border: '1px solid rgba(15,31,76,0.10)', borderRadius: 28, overflow: 'hidden', transition: 'box-shadow .25s' }}>
          <div style={{ padding: '1.5rem 1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0F1F4C', marginBottom: 4, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                Votre token d'accès
              </h3>
              <p style={{ fontSize: '.8rem', color: '#6B7A99', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                Générez un token personnel sécurisé pour connecter votre assistant IA.
              </p>
            </div>
            <button className="btn-new-token" onClick={handleGenerate} disabled={generating} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: '#0F1F4C', color: '#fff', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '.85rem', fontWeight: 600,
              padding: '10px 20px', borderRadius: 10, whiteSpace: 'nowrap',
              transition: 'background .2s, transform .15s', opacity: generating ? .7 : 1,
            }}>
              <Plus size={15} />
              {generating ? 'Génération...' : 'Nouveau token'}
            </button>
          </div>

          {newTokenValue && (
            <div style={{ margin: '0 1.75rem 1.5rem', background: 'rgba(15,31,76,.03)', border: '1px solid rgba(232,185,35,.25)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{
                background: 'rgba(232,185,35,.08)', padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: 7,
                fontSize: '.7rem', fontWeight: 600, color: '#C49A1A',
                letterSpacing: '.06em', textTransform: 'uppercase',
                borderBottom: '1px solid rgba(232,185,35,.2)',
              }}>
                <Shield size={14} />
                Token généré — copiez-le maintenant, il ne sera plus jamais affiché
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 10 }}>
                <code style={{
                  flex: 1, fontFamily: "'DM Mono', monospace", fontSize: '.82rem',
                  color: '#0F1F4C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {newTokenValue}
                </code>
                <button onClick={() => copyText(newTokenValue, 'new')} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: copied === 'new' ? '#059669' : '#0F1F4C', color: '#fff', border: 'none',
                  fontFamily: 'inherit', fontSize: '.75rem', fontWeight: 600,
                  padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                  transition: 'background .2s, transform .1s', whiteSpace: 'nowrap',
                }}>
                  {copied === 'new' ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier</>}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ padding: '2rem 1.75rem 1.75rem', textAlign: 'center', color: '#6B7A99', fontSize: '.85rem', borderTop: '1px solid rgba(15,31,76,0.10)' }}>
              Chargement...
            </div>
          ) : tokens.length === 0 ? (
            <div style={{ padding: '2rem 1.75rem 1.75rem', textAlign: 'center', borderTop: '1px solid rgba(15,31,76,0.10)' }}>
              <Key size={32} style={{ display: 'block', margin: '0 auto .75rem', opacity: .3, color: '#6B7A99' }} />
              <span style={{ color: '#6B7A99', fontSize: '.85rem' }}>
                Aucun token actif. Cliquez sur &quot;Nouveau token&quot; pour commencer.
              </span>
            </div>
          ) : (
            <div>
              {tokens.map((t) => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: '.75rem',
                  padding: '.75rem 1.75rem',
                  borderTop: '1px solid rgba(15,31,76,0.10)',
                  background: t.is_active ? 'rgba(232,185,35,.03)' : 'transparent',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: t.is_active ? 'rgba(232,185,35,.15)' : 'rgba(148,163,184,.12)',
                    color: t.is_active ? '#C49A1A' : '#94a3b8',
                  }}>
                    <Key size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: '.82rem', color: '#0F1F4C' }}>{t.name}</span>
                      {t.is_active ? (
                        <span style={{ fontSize: '.65rem', fontWeight: 700, color: '#0f766e', background: '#d1fae5', padding: '1px 8px', borderRadius: 999 }}>Actif</span>
                      ) : (
                        <span style={{ fontSize: '.65rem', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '1px 8px', borderRadius: 999 }}>Révoqué</span>
                      )}
                    </div>
                    <div style={{ fontSize: '.72rem', color: '#6B7A99', marginTop: 2 }}>
                      Créé le {new Date(t.created_at).toLocaleDateString('fr-FR')}
                      {t.last_used_at && ` · Utilisé le ${new Date(t.last_used_at).toLocaleDateString('fr-FR')}`}
                    </div>
                  </div>
                  <button onClick={() => copyText(t.token, t.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: copied === t.id ? '#059669' : '#0F1F4C', color: '#fff', border: 'none',
                    fontFamily: 'inherit', fontSize: '.72rem', fontWeight: 600,
                    padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                    transition: 'background .2s', whiteSpace: 'nowrap',
                  }}>
                    {copied === t.id ? <Check size={12} /> : <Copy size={12} />}
                    {copied === t.id ? 'Copié' : 'Copier'}
                  </button>
                  {t.is_active && (
                    <button onClick={() => handleRevoke(t.id)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 30, height: 30, borderRadius: 7,
                      background: 'rgba(245,158,11,0.1)', color: '#92400e',
                      border: '1px solid rgba(245,158,11,0.2)', cursor: 'pointer',
                      fontSize: '.75rem',
                    }} title="Révoquer">
                      <Power size={13} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(t.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 30, borderRadius: 7,
                    background: 'rgba(239,68,68,0.08)', color: '#991b1b',
                    border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer',
                    fontSize: '.75rem',
                  }} title="Supprimer">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── CONFIG CARD ─────────── */}
        <div className="anim-4" style={{ background: '#fff', border: '1px solid rgba(15,31,76,0.10)', borderRadius: 28, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem 1.75rem 1rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0F1F4C', marginBottom: '.25rem' }}>Configuration de votre outil</div>
            <div style={{ fontSize: '.8rem', color: '#6B7A99', lineHeight: 1.5 }}>
              Copiez la configuration correspondant à votre assistant IA et remplacez <code style={{ fontFamily: "'DM Mono', monospace", fontSize: '.78rem', background: 'rgba(15,31,76,.06)', padding: '1px 5px', borderRadius: 4 }}>___TOKEN___</code> par votre token.
            </div>
          </div>

          <div style={{
            display: 'flex', gap: 0, borderBottom: '1px solid rgba(15,31,76,0.10)',
            padding: '0 1.75rem', overflowX: 'auto',
          }}>
            {configs.map((c) => (
              <button key={c.id} onClick={() => setActive(c.id)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                padding: '14px 20px 12px', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '.78rem', fontWeight: active === c.id ? 600 : 500,
                color: active === c.id ? '#0F1F4C' : '#6B7A99', whiteSpace: 'nowrap',
                borderBottom: `2px solid ${active === c.id ? '#0F1F4C' : 'transparent'}`,
                marginBottom: -1, transition: 'color .2s, border-color .2s',
              }}>
                <span>{c.name}</span>
              </button>
            ))}
          </div>

          <div style={{ padding: '1.5rem 1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, background: '#0F1F4C',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '.72rem', fontWeight: 700, color: '#fff',
                }}>
                  {current.short}
                </div>
                <div>
                  <div style={{ fontSize: '.88rem', fontWeight: 600, color: '#0F1F4C' }}>{current.name}</div>
                  <div style={{ fontSize: '.78rem', color: '#6B7A99', fontFamily: "'DM Mono', monospace" }}>{current.file}</div>
                </div>
              </div>
              <button onClick={copyConfig} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: copied === 'config' ? 'rgba(5,150,105,.3)' : 'rgba(255,255,255,.08)',
                color: copied === 'config' ? '#6ee7b7' : 'rgba(255,255,255,.7)',
                border: copied === 'config' ? '1px solid rgba(5,150,105,.3)' : '1px solid rgba(255,255,255,.1)',
                borderRadius: 6, fontFamily: 'inherit', fontSize: '.72rem', fontWeight: 500,
                padding: '4px 10px', cursor: 'pointer',
              }}>
                {copied === 'config' ? <Check size={12} /> : <Copy size={12} />}
                {copied === 'config' ? 'Copié' : 'Copier'}
              </button>
            </div>
            <div style={{ background: '#0A1638', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.06)',
              }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }}></span>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }}></span>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }}></span>
                </div>
                <span style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.35)', fontFamily: "'DM Mono', monospace" }}>{current.lang}</span>
              </div>
              <pre style={{
                padding: '1.25rem 1.5rem',
                fontFamily: "'DM Mono', monospace", fontSize: '.8rem',
                lineHeight: 1.75, color: '#e2e8f0',
                overflowX: 'auto', whiteSpace: 'pre', margin: 0,
              }}>
                <code>{configText}</code>
              </pre>
            </div>
            {current.note && (
              <div style={{
                marginTop: '.75rem', padding: '.75rem 1rem',
                background: 'rgba(232,185,35,.07)', border: '1px solid rgba(232,185,35,.2)',
                borderRadius: 10, fontSize: '.78rem', color: '#6B7A99', lineHeight: 1.6,
              }}>
                {current.note}
              </div>
            )}
          </div>
        </div>

        {/* ─── CAPABILITIES ─────────── */}
        <div className="anim-5">
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '.7rem', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6B7A99', marginBottom: '.4rem' }}>
              Ce que vous pouvez faire
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F1F4C', fontFamily: "'Playfair Display', Georgia, serif" }}>
              Capacités disponibles via MCP
            </div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1px', background: 'rgba(15,31,76,0.10)', borderRadius: 20, overflow: 'hidden',
            border: '1px solid rgba(15,31,76,0.10)',
          }}>
            {capabilities.map((cap) => (
              <div key={cap.label} style={{ background: '#fff', padding: '1.25rem 1.5rem', cursor: 'default' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '.75rem',
                  background: cap.color === 'gold' ? 'rgba(232,185,35,.12)' : cap.color === 'green' ? 'rgba(16,185,129,.1)' : cap.color === 'red' ? 'rgba(239,68,68,.08)' : 'rgba(15,31,76,.08)',
                }}>
                  <Key size={18} style={{ color: '#0F1F4C' }} />
                </div>
                <div style={{ fontSize: '.88rem', fontWeight: 600, color: '#0F1F4C', marginBottom: '.3rem' }}>{cap.label}</div>
                <div style={{ fontSize: '.78rem', color: '#6B7A99', lineHeight: 1.55 }}>{cap.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── STEPS ────────────────── */}
        <div className="anim-5" style={{ background: '#fff', border: '1px solid rgba(15,31,76,0.10)', borderRadius: 28, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem 1.75rem 1rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0F1F4C', marginBottom: '.25rem' }}>Prêt à démarrer ?</div>
            <div style={{ fontSize: '.8rem', color: '#6B7A99' }}>4 étapes pour connecter votre assistant IA à ProfCheck.</div>
          </div>
          <div style={{ padding: '1.75rem' }}>
            {steps.map((step, i) => (
              <div key={i} style={{
                display: 'flex', gap: '1rem', padding: '.75rem 0',
                borderBottom: i < steps.length - 1 ? '1px solid rgba(15,31,76,0.10)' : 'none',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: '#0F1F4C', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '.75rem', fontWeight: 700,
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '.9rem', fontWeight: 600, color: '#0F1F4C', marginBottom: '.2rem' }}>{step.title}</div>
                  <div style={{ fontSize: '.8rem', color: '#6B7A99', lineHeight: 1.55 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── CTA ──────────────────── */}
        <div className="anim-6" style={{
          background: '#0F1F4C', borderRadius: 28,
          padding: '2.5rem', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '2rem',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginBottom: '.4rem' }}>
              Une question sur l'intégration ?
            </h3>
            <p style={{ fontSize: '.88rem', color: 'rgba(203,213,225,.8)' }}>
              Notre équipe technique est disponible pour vous aider à connecter ProfCheck à votre workflow IA.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '.75rem', flexShrink: 0, position: 'relative', zIndex: 1 }}>
            <a href="/dashboard" style={{
              background: '#E8B923', color: '#0A1638', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '.85rem', fontWeight: 700,
              padding: '10px 22px', borderRadius: 10, textDecoration: 'none',
              transition: 'background .2s, transform .15s',
            }}>
              Retour au tableau de bord
            </a>
          </div>
        </div>

      </main>

      {/* ─── TOAST ────────────────── */}
      <div className="toast-mcp" id="mcp-toast">
        <span className="toast-dot"></span>
        <span id="mcp-toast-msg">Copié !</span>
      </div>
    </div>
  )
}
