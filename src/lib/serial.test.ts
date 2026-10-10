import { afterEach, describe, expect, it, vi } from 'vitest'
import { DemoDevice } from './demo'
import { describePort, openDemo, validBaud, DEFAULT_PORT } from './serial'
import { parsePlotLine } from './plot'
import { DEFAULT_SETTINGS, sanitize } from './settings'

const enc = (s: string) => new TextEncoder().encode(s)

describe('port options', () => {
  it('describes the framing', () => {
    expect(describePort(DEFAULT_PORT)).toBe('115200 8N1')
    expect(describePort({ ...DEFAULT_PORT, baudRate: 9600, dataBits: 7, parity: 'even', stopBits: 2 })).toBe('9600 7E2')
  })
  it('validates baud rates', () => {
    expect(validBaud(9600)).toBe(true)
    expect(validBaud(0)).toBe(false)
    expect(validBaud(1.5)).toBe(false)
    expect(validBaud(NaN)).toBe(false)
  })
})

describe('DemoDevice', () => {
  it('streams plotter-compatible samples', () => {
    const d = new DemoDevice()
    const e = parsePlotLine(d.tick())!
    expect(e.map((x) => x.label)).toEqual(['temp', 'humidity', 'wave'])
  })
  it('answers commands even when split across writes', () => {
    const d = new DemoDevice()
    expect(d.receive(enc('pi'))).toBe('')
    expect(d.receive(enc('ng\n'))).toBe('pong\r\n')
    expect(d.receive(enc('led on\r\nled\n'))).toBe('LED is ON\r\nLED is ON\r\n')
    expect(d.receive(enc('echo hello world\n'))).toBe('hello world\r\n')
    expect(d.receive(enc('nope\n'))).toBe('Unknown command: nope\r\n')
  })
})

describe('demo session', () => {
  afterEach(() => vi.useRealTimers())
  it('delivers data, replies to writes and closes', async () => {
    vi.useFakeTimers()
    const chunks: string[] = []
    const onClose = vi.fn()
    const s = openDemo({ onData: (d) => chunks.push(new TextDecoder().decode(d)), onError: () => {}, onClose })
    vi.advanceTimersByTime(250)
    expect(chunks.join('')).toContain('Demo Arduino ready')
    expect(chunks.join('')).toContain('temp:')
    await s.write(enc('ping\n'))
    vi.advanceTimersByTime(60)
    expect(chunks.join('')).toContain('pong')
    await s.setSignals({ dataTerminalReady: false })
    expect((await s.getSignals())?.dataSetReady).toBe(false)
    await s.close()
    expect(onClose).toHaveBeenCalledOnce()
    const n = chunks.length
    vi.advanceTimersByTime(1000)
    expect(chunks.length).toBe(n)
  })
})

describe('settings', () => {
  it('falls back to defaults for junk', () => {
    expect(sanitize(null)).toEqual(DEFAULT_SETTINGS)
    expect(sanitize({ lang: 'xx', port: { baudRate: -5, parity: 'weird' }, macros: 'no' }).port).toEqual(DEFAULT_PORT)
  })
  it('keeps valid values and drops invalid macros', () => {
    const s = sanitize({
      lang: 'uk',
      port: { baudRate: 9600, dataBits: 7 },
      eol: 'crlf',
      macros: [{ id: 'a', name: 'x', payload: 'y', mode: 'hex', eol: 'zzz' }, { id: 1 }, null],
    })
    expect(s.lang).toBe('uk')
    expect(s.port.baudRate).toBe(9600)
    expect(s.port.dataBits).toBe(7)
    expect(s.eol).toBe('crlf')
    expect(s.macros).toEqual([{ id: 'a', name: 'x', payload: 'y', mode: 'hex', eol: 'lf' }])
  })
})
