import { useState } from 'react'
import { buildPayload, EOL_KEYS, type EolKey } from '../lib/bytes'
import type { T } from '../i18n'
import type { Controller } from '../useSession'
import type { Macro, Settings } from '../lib/settings'

interface Props {
  ctrl: Controller
  settings: Settings
  onMacros(m: Macro[]): void
  t: T
}

const EOL_SHORT: Record<EolKey, string> = { none: 'none', lf: 'LF', cr: 'CR', crlf: 'CRLF' }

export default function Macros({ ctrl, settings, onMacros, t }: Props) {
  const [name, setName] = useState('')
  const [payload, setPayload] = useState('')
  const [hex, setHex] = useState(false)
  const [eol, setEol] = useState<EolKey>('lf')
  const [editing, setEditing] = useState(false)
  const connected = ctrl.status === 'connected'

  const run = (m: Macro) => {
    const p = buildPayload(m.payload, m.mode, m.eol, true)
    if (p.ok) void ctrl.send(p.bytes, settings.echo)
  }
  const valid = name.trim() !== '' && payload !== '' && (!hex || buildPayload(payload, 'hex', 'none', false).ok)

  return (
    <section className="section">
      <div className="row">
        <h3>{t('Macros')}</h3>
        <span className="spacer" />
        <button className="small" onClick={() => setEditing(!editing)}>
          {editing ? t('Done') : t('Edit')}
        </button>
      </div>
      {settings.macros.length === 0 && <p className="hint">{t('No macros yet. Use Edit to add one.')}</p>}
      <div className="macros">
        {settings.macros.map((m) => (
          <span key={m.id} className="macro">
            <button disabled={!connected || editing} title={`${m.payload} [${EOL_SHORT[m.eol]}]`} onClick={() => run(m)}>
              {m.name}
            </button>
            {editing && (
              <button className="small danger" aria-label={t('Remove')} onClick={() => onMacros(settings.macros.filter((x) => x.id !== m.id))}>
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {editing && (
        <div className="card">
          <label className="field">
            <span>{t('Name')}</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>{hex ? t('Hex bytes') : t('Text (backslash sequences allowed)')}</span>
            <input type="text" value={payload} spellCheck={false} onChange={(e) => setPayload(e.target.value)} />
          </label>
          <div className="row">
            <label className="chk">
              <input type="checkbox" checked={hex} onChange={(e) => setHex(e.target.checked)} />
              {t('Hex')}
            </label>
            <select value={eol} aria-label={t('Line ending')} onChange={(e) => setEol(e.target.value as EolKey)}>
              {EOL_KEYS.map((k) => (
                <option key={k} value={k}>
                  {EOL_SHORT[k]}
                </option>
              ))}
            </select>
            <span className="spacer" />
            <button
              disabled={!valid}
              onClick={() => {
                onMacros([...settings.macros, { id: `m${Date.now()}`, name: name.trim(), payload, mode: hex ? 'hex' : 'text', eol }])
                setName('')
                setPayload('')
              }}
            >
              {t('Add macro')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
