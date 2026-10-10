/** Serial Plotter compatible parsing and a growing multi-series data store. */

export interface PlotEntry {
  label: string | null
  value: number
}

const NUM = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i

/**
 * Parses one line the way the Arduino Serial Plotter does: numbers separated by commas, spaces or tabs,
 * optionally as `label:value` pairs. Returns null unless the whole line is plottable.
 */
export function parsePlotLine(line: string): PlotEntry[] | null {
  const tokens = line.trim().split(/[\s,;]+/).filter((t) => t !== '')
  if (tokens.length === 0) return null
  const out: PlotEntry[] = []
  let pending: string | null = null
  for (const tok of tokens) {
    if (pending !== null) {
      if (!NUM.test(tok)) return null
      out.push({ label: pending, value: Number(tok) })
      pending = null
      continue
    }
    if (NUM.test(tok)) {
      out.push({ label: null, value: Number(tok) })
      continue
    }
    const m = /^([^:=\s]+)[:=](.*)$/.exec(tok)
    if (!m) return null
    if (m[2] === '') pending = m[1]
    else if (NUM.test(m[2])) out.push({ label: m[1], value: Number(m[2]) })
    else return null
  }
  if (pending !== null || out.length === 0) return null
  return out
}

export class PlotData {
  names: string[] = []
  series: number[][] = []
  times: number[] = []
  cap: number
  constructor(cap = 20000) {
    this.cap = cap
  }

  get length(): number {
    return this.times.length
  }

  /** Adds one sample row. Unlabeled values are named ch1, ch2, … by position. */
  add(entries: PlotEntry[], ts: number) {
    const row = new Map<string, number>()
    let pos = 0
    for (const e of entries) {
      const name = e.label ?? `ch${++pos}`
      row.set(name, e.value)
    }
    for (const name of row.keys()) {
      if (!this.names.includes(name)) {
        this.names.push(name)
        this.series.push(new Array<number>(this.times.length).fill(NaN))
      }
    }
    this.names.forEach((n, i) => this.series[i].push(row.get(n) ?? NaN))
    this.times.push(ts)
    if (this.times.length > this.cap * 1.1) {
      const drop = this.times.length - this.cap
      this.times.splice(0, drop)
      this.series.forEach((s) => s.splice(0, drop))
    }
  }

  clear() {
    this.names = []
    this.series = []
    this.times = []
  }

  toCsv(): string {
    const head = ['time', ...this.names].join(',')
    const rows = this.times.map((t, i) =>
      [new Date(t).toISOString(), ...this.series.map((s) => (Number.isNaN(s[i]) ? '' : String(s[i])))].join(','),
    )
    return [head, ...rows].join('\n') + '\n'
  }
}

/** Min/max over the last `n` samples of all series (ignoring NaN); null if no data. */
export function visibleRange(series: number[][], n: number): { min: number; max: number } | null {
  let min = Infinity
  let max = -Infinity
  for (const s of series) {
    for (let i = Math.max(0, s.length - n); i < s.length; i++) {
      const v = s[i]
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  return min <= max ? { min, max } : null
}

/** "Nice" axis ticks (1, 2, 5 × 10^k) covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) {
    const d = Math.abs(min) || 1
    min -= d / 2
    max += d / 2
  }
  const raw = (max - min) / Math.max(1, count)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.round(v / step) * step)
  return out
}

export const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#65a30d']
