import { useEffect, useRef, useState } from 'react'
import { COLORS, niceTicks, visibleRange } from '../lib/plot'
import { download, stamp } from '../lib/download'
import type { T } from '../i18n'
import type { Controller } from '../useSession'
import type { Settings } from '../lib/settings'

const WINDOWS = [100, 200, 500, 1000, 2000, 5000] as const

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '–'
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(2)
  return String(Math.round(v * 1000) / 1000)
}

interface Props {
  ctrl: Controller
  settings: Settings
  onSettings(p: Partial<Settings>): void
  t: T
}

export default function Plotter({ ctrl, settings, onSettings, t }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 600, h: 240 })
  const [hover, setHover] = useState<number | null>(null)
  const { plot } = ctrl
  const n = Math.min(settings.plotWindow, plot.length)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: Math.max(200, el.clientWidth), h: Math.max(140, el.clientHeight) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(size.w * dpr)
    c.height = Math.round(size.h * dpr)
    const g = c.getContext('2d')
    if (!g) return
    g.scale(dpr, dpr)
    const css = getComputedStyle(document.documentElement)
    const col = (v: string) => css.getPropertyValue(v).trim()
    g.fillStyle = col('--chart-bg')
    g.fillRect(0, 0, size.w, size.h)
    g.font = '11px system-ui, sans-serif'
    const L = 52, R = 10, Tp = 8, B = 18
    const pw = size.w - L - R, ph = size.h - Tp - B
    const range = visibleRange(plot.series, settings.plotWindow)
    if (!range || n < 1) {
      g.fillStyle = col('--muted')
      g.textAlign = 'center'
      g.fillText(t('Waiting for numeric lines such as "12,34" or "temp:21.5,hum:40"'), size.w / 2, size.h / 2)
      return
    }
    let { min, max } = range
    if (min === max) {
      min -= 1
      max += 1
    }
    const pad = (max - min) * 0.06
    min -= pad
    max += pad
    const X = (i: number) => L + (n <= 1 ? pw / 2 : (i / (n - 1)) * pw)
    const Y = (v: number) => Tp + ph - ((v - min) / (max - min)) * ph
    g.textAlign = 'right'
    g.textBaseline = 'middle'
    for (const tk of niceTicks(min, max, Math.max(2, Math.floor(ph / 40)))) {
      const y = Math.round(Y(tk)) + 0.5
      g.strokeStyle = tk === 0 ? col('--grid-strong') : col('--grid')
      g.beginPath()
      g.moveTo(L, y)
      g.lineTo(L + pw, y)
      g.stroke()
      g.fillStyle = col('--chart-fg')
      g.fillText(fmt(tk), L - 6, y)
    }
    g.textAlign = 'center'
    g.textBaseline = 'alphabetic'
    g.fillStyle = col('--chart-fg')
    g.fillText(`−${n - 1}`, L + 10, size.h - 4)
    g.fillText('0', L + pw - 4, size.h - 4)
    g.save()
    g.beginPath()
    g.rect(L, Tp, pw, ph)
    g.clip()
    g.lineWidth = 1.5
    g.lineJoin = 'round'
    plot.series.forEach((s, k) => {
      g.strokeStyle = COLORS[k % COLORS.length]
      g.beginPath()
      let pen = false
      const off = s.length - n
      for (let i = 0; i < n; i++) {
        const v = s[off + i]
        if (Number.isNaN(v)) {
          pen = false
          continue
        }
        if (pen) g.lineTo(X(i), Y(v))
        else g.moveTo(X(i), Y(v))
        pen = true
      }
      g.stroke()
    })
    if (hover !== null && hover < n) {
      g.strokeStyle = col('--grid-strong')
      g.beginPath()
      g.moveTo(Math.round(X(hover)) + 0.5, Tp)
      g.lineTo(Math.round(X(hover)) + 0.5, Tp + ph)
      g.stroke()
    }
    g.restore()
    g.strokeStyle = col('--line')
    g.strokeRect(L + 0.5, Tp + 0.5, pw, ph)
  }, [ctrl.version, size, settings.plotWindow, hover, plot, n, t, settings.theme])

  const onMove = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - r.left - 52
    const pw = r.width - 62
    setHover(n < 1 ? null : Math.max(0, Math.min(n - 1, Math.round((x / pw) * (n - 1)))))
  }

  const idx = hover !== null && hover < n ? plot.length - n + hover : plot.length - 1
  return (
    <section className="box plotter">
      <div className="row tbar">
        <h3>{t('Plotter')}</h3>
        <span className="spacer" />
        <label className="inline">
          {t('Window')}
          <select value={settings.plotWindow} onChange={(e) => onSettings({ plotWindow: Number(e.target.value) })}>
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w} {t('points')}
              </option>
            ))}
          </select>
        </label>
        <button className="small" onClick={() => ctrl.setPlotPaused(!ctrl.plotPaused)}>
          {ctrl.plotPaused ? t('Resume') : t('Pause')}
        </button>
        <button
          className="small"
          disabled={plot.length === 0}
          onClick={() => download(`serial-plot-${stamp()}.csv`, plot.toCsv(), 'text/csv')}
        >
          {t('Export CSV')}
        </button>
        <button className="small" disabled={plot.length === 0} onClick={ctrl.clearPlot}>
          {t('Clear')}
        </button>
      </div>
      <div className="plot-canvas" ref={wrap} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <canvas ref={canvas} style={{ width: size.w, height: size.h }} role="img" aria-label={t('Live plot of numeric serial values')} />
      </div>
      {plot.names.length > 0 && (
        <div className="legend">
          {plot.names.map((name, k) => (
            <span key={name} className="lg">
              <i style={{ background: COLORS[k % COLORS.length] }} />
              {name}: <b>{fmt(plot.series[k][idx])}</b>
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
