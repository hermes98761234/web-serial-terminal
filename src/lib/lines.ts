/** Splits a byte stream into display lines, keeping direction and timestamps. */

export type Dir = 'rx' | 'tx' | 'sys'

export interface Line {
  id: number
  ts: number
  dir: Dir
  bytes: number[]
  /** false while an RX line is still waiting for its newline. */
  done: boolean
}

const dec = new TextDecoder('utf-8')

/** Text of a line: decoded as UTF-8, trailing CR/LF removed, other control characters dropped. */
export function lineText(l: Pick<Line, 'bytes'>): string {
  let end = l.bytes.length
  while (end > 0 && (l.bytes[end - 1] === 10 || l.bytes[end - 1] === 13)) end--
  const text = dec.decode(Uint8Array.from(l.bytes.slice(0, end)))
  // Keep tabs and printable text; drop other control characters.
  return Array.from(text).filter((c) => c === '\t' || (c.codePointAt(0)! >= 32 && c.codePointAt(0) !== 127)).join('')
}

export class LineStore {
  lines: Line[] = []
  private nextId = 1
  maxLines: number
  maxLineBytes: number
  constructor(maxLines = 20000, maxLineBytes = 1024) {
    this.maxLines = maxLines
    this.maxLineBytes = maxLineBytes
  }

  private push(dir: Dir, ts: number, bytes: number[], done: boolean): Line {
    const l: Line = { id: this.nextId++, ts, dir, bytes, done }
    this.lines.push(l)
    return l
  }

  private trim() {
    if (this.lines.length > this.maxLines * 1.1) this.lines.splice(0, this.lines.length - this.maxLines)
  }

  /** Appends received bytes; returns the lines that were completed by this chunk. */
  appendRx(data: ArrayLike<number>, ts: number): Line[] {
    const completed: Line[] = []
    let cur = this.lines[this.lines.length - 1]
    for (let i = 0; i < data.length; i++) {
      if (!cur || cur.dir !== 'rx' || cur.done) cur = this.push('rx', ts, [], false)
      const b = data[i]
      cur.bytes.push(b)
      if (b === 10 || cur.bytes.length >= this.maxLineBytes) {
        cur.done = true
        completed.push(cur)
      }
    }
    this.trim()
    return completed
  }

  appendTx(data: ArrayLike<number>, ts: number): Line {
    const l = this.push('tx', ts, Array.from(data), true)
    this.trim()
    return l
  }

  sys(text: string, ts: number): Line {
    const l = this.push('sys', ts, Array.from(new TextEncoder().encode(text)), true)
    this.trim()
    return l
  }

  clear() {
    this.lines = []
  }
}

export function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0')
}

/** Local time as HH:MM:SS.mmm */
export function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

/** Plain-text log with ISO timestamps, one line per entry. */
export function formatLog(lines: Line[], opts: { hex?: boolean } = {}): string {
  return lines
    .map((l) => {
      const tag = l.dir === 'rx' ? 'RX' : l.dir === 'tx' ? 'TX' : '--'
      const body = opts.hex
        ? l.bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')
        : lineText(l)
      return `${new Date(l.ts).toISOString()} ${tag} ${body}`
    })
    .join('\n') + (lines.length ? '\n' : '')
}
