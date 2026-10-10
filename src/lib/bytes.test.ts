import { describe, expect, it } from 'vitest'
import { asciiOf, buildPayload, hexRows, parseHex, textToBytes, toHex } from './bytes'

const arr = (u: Uint8Array) => Array.from(u)

describe('textToBytes', () => {
  it('encodes UTF-8 and keeps backslashes literal without escapes', () => {
    expect(arr(textToBytes('Aé\\n', false))).toEqual([0x41, 0xc3, 0xa9, 0x5c, 0x6e])
  })
  it('interprets escapes when enabled', () => {
    expect(arr(textToBytes('a\\n\\r\\t\\0\\\\\\x41', true))).toEqual([97, 10, 13, 9, 0, 92, 0x41])
  })
  it('leaves unknown or incomplete escapes alone', () => {
    expect(arr(textToBytes('\\q\\x4', true))).toEqual([92, 113, 92, 120, 52])
    expect(arr(textToBytes('end\\', true))).toEqual([101, 110, 100, 92])
  })
})

describe('parseHex', () => {
  it('accepts several separators and 0x prefixes', () => {
    for (const s of ['48 65 6C', '0x48,0x65,0x6c', '48:65:6c', '48656c', '48-65-6C']) {
      expect(arr((parseHex(s) as { bytes: Uint8Array }).bytes)).toEqual([0x48, 0x65, 0x6c])
    }
  })
  it('accepts an empty string', () => {
    expect(parseHex('  ')).toEqual({ ok: true, bytes: new Uint8Array(0) })
  })
  it('reports the offending token', () => {
    expect(parseHex('48 zz')).toEqual({ ok: false, error: 'zz' })
    expect(parseHex('4 8')).toEqual({ ok: false, error: '4' })
    expect(parseHex('123')).toEqual({ ok: false, error: '123' })
  })
})

describe('buildPayload', () => {
  it('appends the chosen line ending', () => {
    const p = buildPayload('hi', 'text', 'crlf', false)
    expect(p.ok && arr(p.bytes)).toEqual([104, 105, 13, 10])
    const q = buildPayload('hi', 'text', 'none', false)
    expect(q.ok && arr(q.bytes)).toEqual([104, 105])
  })
  it('supports hex payloads and surfaces errors', () => {
    const p = buildPayload('DE AD', 'hex', 'cr', true)
    expect(p.ok && arr(p.bytes)).toEqual([0xde, 0xad, 13])
    expect(buildPayload('xx', 'hex', 'lf', false).ok).toBe(false)
  })
})

describe('hex dump', () => {
  it('formats bytes as upper-case hex and printable ASCII', () => {
    expect(toHex([0, 15, 255])).toBe('00 0F FF')
    expect(asciiOf([72, 105, 10, 200])).toBe('Hi..')
  })
  it('splits into 16-byte rows with offsets', () => {
    const rows = hexRows(Array.from({ length: 20 }, (_, i) => 65 + i))
    expect(rows).toHaveLength(2)
    expect(rows[1].offset).toBe(16)
    expect(rows[1].hex).toBe('51 52 53 54')
    expect(rows[0].ascii).toBe('ABCDEFGHIJKLMNOP')
  })
})
