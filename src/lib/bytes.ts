/** Byte helpers: line endings, escape sequences, hex parsing and hex dump rows. */

export type EolKey = 'none' | 'lf' | 'cr' | 'crlf'
export const EOL: Record<EolKey, string> = { none: '', lf: '\n', cr: '\r', crlf: '\r\n' }
export const EOL_KEYS: EolKey[] = ['none', 'lf', 'cr', 'crlf']

const enc = new TextEncoder()

/** Encodes text to UTF-8, turning \n \r \t \0 \\ and \xNN into bytes when `escapes` is on. */
export function textToBytes(s: string, escapes: boolean): Uint8Array {
  if (!escapes) return enc.encode(s)
  const out: number[] = []
  const chars = [...s]
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    if (c !== '\\' || i === chars.length - 1) {
      out.push(...enc.encode(c))
      continue
    }
    const n = chars[i + 1]
    const simple: Record<string, number> = { n: 10, r: 13, t: 9, '0': 0, '\\': 92 }
    if (n in simple) {
      out.push(simple[n])
      i++
    } else if (n === 'x' && /^[0-9a-fA-F]{2}$/.test((chars[i + 2] ?? '') + (chars[i + 3] ?? ''))) {
      out.push(parseInt(chars[i + 2] + chars[i + 3], 16))
      i += 3
    } else {
      out.push(...enc.encode(c))
    }
  }
  return Uint8Array.from(out)
}

export type HexResult = { ok: true; bytes: Uint8Array } | { ok: false; error: string }

/** Parses "48 65 6C", "0x48,0x65", "4865" into bytes. */
export function parseHex(s: string): HexResult {
  const cleaned = s.replace(/0x/gi, ' ').replace(/[\s,;:-]+/g, ' ').trim()
  if (cleaned === '') return { ok: true, bytes: new Uint8Array(0) }
  const out: number[] = []
  for (const tok of cleaned.split(' ')) {
    if (!/^[0-9a-fA-F]+$/.test(tok)) return { ok: false, error: tok }
    if (tok.length % 2 !== 0) return { ok: false, error: tok }
    for (let i = 0; i < tok.length; i += 2) out.push(parseInt(tok.slice(i, i + 2), 16))
  }
  return { ok: true, bytes: Uint8Array.from(out) }
}

export function toHex(bytes: ArrayLike<number>, sep = ' '): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(sep)
}

export function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

export type Payload = { ok: true; bytes: Uint8Array } | { ok: false; error: string }

/** Builds the bytes to transmit: payload (text or hex) followed by the line ending. */
export function buildPayload(text: string, mode: 'text' | 'hex', eol: EolKey, escapes: boolean): Payload {
  let body: Uint8Array
  if (mode === 'hex') {
    const r = parseHex(text)
    if (!r.ok) return r
    body = r.bytes
  } else body = textToBytes(text, escapes)
  return { ok: true, bytes: concat(body, enc.encode(EOL[eol])) }
}

export function asciiOf(bytes: ArrayLike<number>): string {
  return Array.from(bytes, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('')
}

export interface HexRow {
  offset: number
  hex: string
  ascii: string
}

export function hexRows(bytes: ArrayLike<number>, width = 16): HexRow[] {
  const rows: HexRow[] = []
  const arr = Array.from(bytes)
  for (let i = 0; i < arr.length; i += width) {
    const part = arr.slice(i, i + width)
    rows.push({ offset: i, hex: toHex(part), ascii: asciiOf(part) })
  }
  return rows
}
