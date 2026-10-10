import { useRef, useState } from 'react'
import { buildPayload, EOL_KEYS, type EolKey } from '../lib/bytes'
import type { T } from '../i18n'
import type { Controller } from '../useSession'
import type { Settings } from '../lib/settings'

const EOL_LABEL: Record<EolKey, string> = { none: 'No line ending', lf: 'Newline (LF)', cr: 'Carriage return (CR)', crlf: 'CR + LF' }

interface Props {
  ctrl: Controller
  settings: Settings
  onSettings(p: Partial<Settings>): void
  t: T
}

export default function SendBar({ ctrl, settings, onSettings, t }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const history = useRef<string[]>([])
  const pos = useRef(-1)
  const connected = ctrl.status === 'connected'
  const mode = settings.sendHex ? 'hex' : 'text'

  const submit = async () => {
    const p = buildPayload(text, mode, settings.eol, settings.escapes)
    if (!p.ok) {
      setError(t('Invalid hex: {0}', p.error))
      return
    }
    setError('')
    if (p.bytes.length === 0) return
    if (await ctrl.send(p.bytes, settings.echo)) {
      if (text && history.current[0] !== text) history.current.unshift(text)
      history.current = history.current.slice(0, 50)
      pos.current = -1
      setText('')
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void submit()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const h = history.current
      if (h.length === 0) return
      e.preventDefault()
      pos.current = e.key === 'ArrowUp' ? Math.min(h.length - 1, pos.current + 1) : Math.max(-1, pos.current - 1)
      setText(pos.current < 0 ? '' : h[pos.current])
    }
  }

  return (
    <section className="box sendbar">
      <div className="row">
        <input
          className="send-input"
          type="text"
          value={text}
          placeholder={settings.sendHex ? t('Hex bytes, e.g. 48 65 6C 6C 6F') : t('Type a message and press Enter')}
          aria-label={t('Message to send')}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value)
            setError('')
          }}
          onKeyDown={onKey}
        />
        <select value={settings.eol} aria-label={t('Line ending')} onChange={(e) => onSettings({ eol: e.target.value as EolKey })}>
          {EOL_KEYS.map((k) => (
            <option key={k} value={k}>
              {t(EOL_LABEL[k])}
            </option>
          ))}
        </select>
        <button className="primary" disabled={!connected} onClick={() => void submit()}>
          {t('Send')}
        </button>
      </div>
      <div className="row opts">
        <label className="chk">
          <input type="checkbox" checked={settings.sendHex} onChange={(e) => onSettings({ sendHex: e.target.checked })} />
          {t('Send as hex')}
        </label>
        <label className="chk" title={t('Turn backslash sequences such as newline and hex bytes into real bytes')}>
          <input type="checkbox" checked={settings.escapes} disabled={settings.sendHex} onChange={(e) => onSettings({ escapes: e.target.checked })} />
          {t('Escape sequences')}
        </label>
        <label className="chk">
          <input type="checkbox" checked={settings.echo} onChange={(e) => onSettings({ echo: e.target.checked })} />
          {t('Local echo')}
        </label>
        {error && <span className="err-text">{error}</span>}
      </div>
    </section>
  )
}
