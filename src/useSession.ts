import { useCallback, useEffect, useRef, useState } from 'react'
import { LineStore, lineText } from './lib/lines'
import { parsePlotLine, PlotData } from './lib/plot'
import { openDemo, openWebSerial, type Handlers, type InSignals, type PortOptions, type Session } from './lib/serial'

export type Status = 'idle' | 'connecting' | 'connected'

export interface Controller {
  status: Status
  demo: boolean
  /** Bumped whenever new data arrived (batched per animation frame). */
  version: number
  store: LineStore
  plot: PlotData
  rxBytes: number
  txBytes: number
  signals: InSignals | null
  dtr: boolean
  rts: boolean
  plotPaused: boolean
  setPlotPaused(p: boolean): void
  connect(opts: PortOptions, demo: boolean): Promise<void>
  disconnect(): Promise<void>
  send(bytes: Uint8Array, echo: boolean): Promise<boolean>
  setDtr(v: boolean): Promise<void>
  setRts(v: boolean): Promise<void>
  pulseReset(): Promise<void>
  sendBreak(): Promise<void>
  clear(): void
  clearPlot(): void
}

/** Owns the connection and the data buffers; React re-renders once per animation frame at most. */
export function useSession(): Controller {
  const [store] = useState(() => new LineStore())
  const [plot] = useState(() => new PlotData())
  const session = useRef<Session | null>(null)
  const counts = useRef({ rx: 0, tx: 0 })
  const paused = useRef(false)
  const raf = useRef(0)
  const [status, setStatus] = useState<Status>('idle')
  const [demo, setDemo] = useState(false)
  const [version, setVersion] = useState(0)
  const [totals, setTotals] = useState({ rx: 0, tx: 0 })
  const [signals, setSignals] = useState<InSignals | null>(null)
  const [dtr, setDtrState] = useState(true)
  const [rts, setRtsState] = useState(true)
  const [plotPaused, setPausedState] = useState(false)

  const bump = useCallback(() => {
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      setVersion((v) => v + 1)
      setTotals({ rx: counts.current.rx, tx: counts.current.tx })
    })
  }, [])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const sys = useCallback(
    (msg: string) => {
      store.sys(msg, Date.now())
      bump()
    },
    [store, bump],
  )

  const connect = useCallback(
    async (opts: PortOptions, isDemo: boolean) => {
      if (session.current) return
      setStatus('connecting')
      const h: Handlers = {
        onData(d) {
          counts.current.rx += d.length
          for (const l of store.appendRx(d, Date.now())) {
            if (paused.current) continue
            const e = parsePlotLine(lineText(l))
            if (e) plot.add(e, l.ts)
          }
          bump()
        },
        onError: (m) => sys(`! ${m}`),
        onClose(reason) {
          session.current = null
          setStatus('idle')
          setSignals(null)
          sys(`* ${reason}`)
        },
      }
      try {
        const s = isDemo ? openDemo(h) : await openWebSerial(opts, h)
        session.current = s
        setDemo(isDemo)
        setDtrState(true)
        setRtsState(true)
        setStatus('connected')
        sys(isDemo ? '* Demo mode connected' : `* Connected at ${opts.baudRate} baud`)
        if (!isDemo) void s.setSignals({ dataTerminalReady: true, requestToSend: true }).catch(() => {})
      } catch (e) {
        session.current = null
        setStatus('idle')
        const err = e as Error
        // Closing the browser's port picker is not an error worth showing.
        if (err.name !== 'NotFoundError') sys(`! ${err.name}: ${err.message}`)
      }
    },
    [store, plot, bump, sys],
  )

  const disconnect = useCallback(async () => {
    await session.current?.close()
  }, [])

  // Poll the modem input lines (CTS/DSR/DCD/RI) while connected.
  useEffect(() => {
    if (status !== 'connected') return
    let stop = false
    const poll = async () => {
      try {
        const s = await session.current?.getSignals()
        if (!stop && s) setSignals(s)
      } catch {
        // not supported on this adapter
      }
    }
    void poll()
    const id = setInterval(poll, 500)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [status])

  // Release the port if the page goes away.
  useEffect(() => () => void session.current?.close(), [])

  const send = useCallback(
    async (bytes: Uint8Array, echo: boolean) => {
      const s = session.current
      if (!s) return false
      try {
        await s.write(bytes)
        counts.current.tx += bytes.length
        if (echo) store.appendTx(bytes, Date.now())
        bump()
        return true
      } catch (e) {
        sys(`! ${(e as Error).message}`)
        return false
      }
    },
    [store, bump, sys],
  )

  const setDtr = useCallback(
    async (v: boolean) => {
      try {
        await session.current?.setSignals({ dataTerminalReady: v })
        setDtrState(v)
      } catch (e) {
        sys(`! ${(e as Error).message}`)
      }
    },
    [sys],
  )
  const setRts = useCallback(
    async (v: boolean) => {
      try {
        await session.current?.setSignals({ requestToSend: v })
        setRtsState(v)
      } catch (e) {
        sys(`! ${(e as Error).message}`)
      }
    },
    [sys],
  )

  const pulseReset = useCallback(async () => {
    const s = session.current
    if (!s) return
    try {
      await s.setSignals({ dataTerminalReady: false })
      setDtrState(false)
      await new Promise((r) => setTimeout(r, 100))
      await s.setSignals({ dataTerminalReady: true })
      setDtrState(true)
      sys('* DTR pulse (reset)')
    } catch (e) {
      sys(`! ${(e as Error).message}`)
    }
  }, [sys])

  const sendBreak = useCallback(async () => {
    const s = session.current
    if (!s) return
    try {
      await s.setSignals({ break: true })
      await new Promise((r) => setTimeout(r, 250))
      await s.setSignals({ break: false })
      sys('* Break sent')
    } catch (e) {
      sys(`! ${(e as Error).message}`)
    }
  }, [sys])

  return {
    status,
    demo,
    version,
    store,
    plot,
    rxBytes: totals.rx,
    txBytes: totals.tx,
    signals,
    dtr,
    rts,
    plotPaused,
    setPlotPaused(p) {
      paused.current = p
      setPausedState(p)
    },
    connect,
    disconnect,
    send,
    setDtr,
    setRts,
    pulseReset,
    sendBreak,
    clear() {
      store.clear()
      counts.current = { rx: 0, tx: 0 }
      bump()
    },
    clearPlot() {
      plot.clear()
      bump()
    },
  }
}
