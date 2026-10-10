import { describe, expect, it } from 'vitest'
import { formatLog, LineStore, lineText } from './lines'

const bytes = (s: string) => Array.from(new TextEncoder().encode(s))

describe('LineStore', () => {
  it('splits lines across chunk boundaries and strips CRLF', () => {
    const s = new LineStore()
    expect(s.appendRx(bytes('hel'), 1)).toHaveLength(0)
    expect(s.lines[0].done).toBe(false)
    const done = s.appendRx(bytes('lo\r\nwor'), 2)
    expect(done).toHaveLength(1)
    expect(lineText(done[0])).toBe('hello')
    expect(s.lines).toHaveLength(2)
    expect(lineText(s.lines[1])).toBe('wor')
    expect(s.lines[1].done).toBe(false)
  })
  it('handles several lines in one chunk', () => {
    const s = new LineStore()
    const done = s.appendRx(bytes('a\nb\nc\n'), 1)
    expect(done.map(lineText)).toEqual(['a', 'b', 'c'])
  })
  it('force-breaks very long lines', () => {
    const s = new LineStore(100, 10)
    const done = s.appendRx(new Uint8Array(25).fill(65), 1)
    expect(done).toHaveLength(2)
    expect(s.lines).toHaveLength(3)
  })
  it('starts a new RX line after TX data', () => {
    const s = new LineStore()
    s.appendRx(bytes('par'), 1)
    s.appendTx(bytes('cmd\n'), 2)
    s.appendRx(bytes('tial\n'), 3)
    expect(s.lines.map((l) => l.dir)).toEqual(['rx', 'tx', 'rx'])
  })
  it('trims old lines past the cap', () => {
    const s = new LineStore(10, 100)
    for (let i = 0; i < 30; i++) s.appendRx(bytes(`l${i}\n`), i)
    expect(s.lines.length).toBeLessThanOrEqual(11)
    expect(lineText(s.lines[s.lines.length - 1])).toBe('l29')
  })
})

describe('lineText', () => {
  it('decodes UTF-8 and drops control characters', () => {
    expect(lineText({ bytes: [...bytes('Привіт'), 7, 13, 10] })).toBe('Привіт')
  })
})

describe('formatLog', () => {
  it('writes ISO timestamp, direction and text', () => {
    const s = new LineStore()
    s.appendRx(bytes('ok\n'), Date.UTC(2026, 0, 2, 3, 4, 5, 6))
    s.appendTx(bytes('go\n'), Date.UTC(2026, 0, 2, 3, 4, 6))
    expect(formatLog(s.lines)).toBe('2026-01-02T03:04:05.006Z RX ok\n2026-01-02T03:04:06.000Z TX go\n')
    expect(formatLog(s.lines, { hex: true }).split('\n')[0]).toBe('2026-01-02T03:04:05.006Z RX 6f 6b 0a')
  })
})
