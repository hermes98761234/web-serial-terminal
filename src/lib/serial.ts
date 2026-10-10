/** Connection layer: Web Serial wrapper and a demo transport behind one Session interface. */
import { DemoDevice } from './demo'

export interface PortOptions {
  baudRate: number
  dataBits: 7 | 8
  stopBits: 1 | 2
  parity: 'none' | 'even' | 'odd'
  flowControl: 'none' | 'hardware'
}

export const DEFAULT_PORT: PortOptions = { baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' }
export const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 250000, 460800, 500000, 921600, 1000000, 2000000]

export interface InSignals {
  clearToSend: boolean
  dataSetReady: boolean
  dataCarrierDetect: boolean
  ringIndicator: boolean
}
export interface OutSignals {
  dataTerminalReady?: boolean
  requestToSend?: boolean
  break?: boolean
}

export interface Handlers {
  onData(d: Uint8Array): void
  /** Non-fatal read problems (framing, parity, overrun). */
  onError(msg: string): void
  onClose(reason: string): void
}

export interface Session {
  demo: boolean
  write(d: Uint8Array): Promise<void>
  setSignals(s: OutSignals): Promise<void>
  getSignals(): Promise<InSignals | null>
  close(): Promise<void>
}

export function validBaud(n: number): boolean {
  return Number.isInteger(n) && n >= 50 && n <= 12_000_000
}

/** "115200 8N1" */
export function describePort(o: PortOptions): string {
  return `${o.baudRate} ${o.dataBits}${o.parity[0].toUpperCase()}${o.stopBits}${o.flowControl === 'hardware' ? ' RTS/CTS' : ''}`
}

/* Minimal Web Serial typings (not in lib.dom). */
interface SerialPortLike extends EventTarget {
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  open(o: PortOptions & { bufferSize?: number }): Promise<void>
  close(): Promise<void>
  setSignals(s: OutSignals): Promise<void>
  getSignals(): Promise<InSignals>
}
interface SerialLike extends EventTarget {
  requestPort(o?: object): Promise<SerialPortLike>
}

function getSerial(): SerialLike | null {
  const s = (navigator as unknown as { serial?: SerialLike }).serial
  return s ?? null
}

export function webSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && getSerial() !== null
}

export async function openWebSerial(opts: PortOptions, h: Handlers): Promise<Session> {
  const serial = getSerial()
  if (!serial) throw new Error('Web Serial is not available')
  const port = await serial.requestPort()
  await port.open({ ...opts, bufferSize: 65536 })
  let closing = false
  let closed = false
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null

  const finish = (reason: string) => {
    if (closed) return
    closed = true
    serial.removeEventListener('disconnect', onDisconnect)
    h.onClose(reason)
  }
  const onDisconnect = (e: Event) => {
    if (e.target === port) {
      closing = true
      void reader?.cancel().catch(() => {})
      finish('Device disconnected')
    }
  }
  serial.addEventListener('disconnect', onDisconnect)

  const loop = (async () => {
    while (port.readable && !closing) {
      reader = port.readable.getReader()
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          if (value && value.length) h.onData(value)
        }
      } catch (e) {
        const err = e as Error
        if (err.name === 'NetworkError') {
          closing = true
          finish('Device lost')
        } else if (!closing) h.onError(`${err.name}: ${err.message}`)
      } finally {
        reader.releaseLock()
        reader = null
      }
    }
  })()

  return {
    demo: false,
    async write(d) {
      if (!port.writable) throw new Error('Port is not writable')
      const w = port.writable.getWriter()
      try {
        await w.write(d)
      } finally {
        w.releaseLock()
      }
    },
    setSignals: (s) => port.setSignals(s),
    getSignals: () => port.getSignals(),
    async close() {
      closing = true
      try {
        await reader?.cancel()
      } catch {
        // already gone
      }
      await loop
      try {
        await port.close()
      } catch {
        // already closed
      }
      finish('Disconnected')
    },
  }
}

export function openDemo(h: Handlers): Session {
  const dev = new DemoDevice()
  const enc = new TextEncoder()
  let closed = false
  const emit = (s: string) => {
    if (!closed) h.onData(enc.encode(s))
  }
  setTimeout(() => emit(dev.banner()), 100)
  const timer = setInterval(() => emit(dev.tick()), 100)
  let sig: OutSignals = { dataTerminalReady: true, requestToSend: true }
  return {
    demo: true,
    async write(d) {
      const reply = dev.receive(d)
      if (reply) setTimeout(() => emit(reply), 40)
    },
    async setSignals(s) {
      sig = { ...sig, ...s }
    },
    async getSignals() {
      return { clearToSend: !!sig.requestToSend, dataSetReady: !!sig.dataTerminalReady, dataCarrierDetect: false, ringIndicator: false }
    },
    async close() {
      if (closed) return
      closed = true
      clearInterval(timer)
      h.onClose('Disconnected')
    },
  }
}
