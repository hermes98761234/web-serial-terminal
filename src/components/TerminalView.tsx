import { useLayoutEffect, useRef, useState } from 'react'
import { hexRows } from '../lib/bytes'
import { fmtTime, formatLog, lineText, type Line } from '../lib/lines'
import { download, stamp } from '../lib/download'
import type { T } from '../i18n'
import type { Controller } from '../useSession'
import type { Settings } from '../lib/settings'

const VISIBLE = 1000


function LineView({ l, hex, ts }: { l: Line; hex: boolean; ts: boolean }) {
  const time = ts ? <span className="ts">{fmtTime(l.ts)}</span> : null
  if (l.dir === 'sys') {
    return (
      <div className="ln sys">
        {time}
        {lineText(l)}
      </div>
    )
  }
  if (!hex) {
    return (
      <div className={`ln ${l.dir}`}>
        {time}
        {l.dir === 'tx' && <span className="dir">&gt; </span>}
        {lineText(l) || '\u00a0'}
      </div>
    )
  }
  return (
    <div className={`ln ${l.dir}`}>
      {hexRows(l.bytes).map((r, i) => (
        <div key={i} className="hexrow">
          {i === 0 ? time : ts ? <span className="ts" /> : null}
          <span className="dir">{l.dir === 'tx' ? '> ' : '  '}</span>
          <span className="hx">{r.hex.padEnd(47, ' ')}</span>
          <span className="asc">{r.ascii}</span>
        </div>
      ))}
    </div>
  )
}

interface Props {
  ctrl: Controller
  settings: Settings
  onSettings(p: Partial<Settings>): void
  t: T
}

export default function TerminalView({ ctrl, settings, onSettings, t }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [auto, setAuto] = useState(true)
  const all = ctrl.store.lines
  const lines = all.length > VISIBLE ? all.slice(all.length - VISIBLE) : all

  useLayoutEffect(() => {
    const el = box.current
    if (el && auto) el.scrollTop = el.scrollHeight
  }, [ctrl.version, auto, settings.view, settings.timestamps])

  const onScroll = () => {
    const el = box.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    if (atBottom !== auto) setAuto(atBottom)
  }

  const hex = settings.view === 'hex'
  return (
    <section className="box terminal">
      <div className="row tbar">
        <h3>{t('Terminal')}</h3>
        <span className="hint">
          RX {ctrl.rxBytes} B · TX {ctrl.txBytes} B
        </span>
        <span className="spacer" />
        <div className="seg" role="group" aria-label={t('View')}>
          <button className={!hex ? 'on' : ''} onClick={() => onSettings({ view: 'text' })}>
            {t('Text')}
          </button>
          <button className={hex ? 'on' : ''} onClick={() => onSettings({ view: 'hex' })}>
            {t('Hex')}
          </button>
        </div>
        <label className="chk">
          <input type="checkbox" checked={settings.timestamps} onChange={(e) => onSettings({ timestamps: e.target.checked })} />
          {t('Timestamps')}
        </label>
        <label className="chk">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          {t('Autoscroll')}
        </label>
        <button className="small" disabled={all.length === 0} onClick={() => download(`serial-log-${stamp()}.txt`, formatLog(all, { hex }))}>
          {t('Save log')}
        </button>
        <button className="small" disabled={all.length === 0} onClick={ctrl.clear}>
          {t('Clear')}
        </button>
      </div>
      <div className="out" ref={box} onScroll={onScroll} tabIndex={0} aria-label={t('Terminal output')}>
        {lines.length === 0 && <div className="ln sys">{t('No data yet. Connect a device or start the demo.')}</div>}
        {lines.map((l) => (
          <LineView key={l.id} l={l} hex={hex} ts={settings.timestamps} />
        ))}
      </div>
    </section>
  )
}
