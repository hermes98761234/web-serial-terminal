import type { EolKey } from './bytes'
import { DEFAULT_PORT, type PortOptions } from './serial'

export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'
export type ViewMode = 'text' | 'hex'
export type Layout = 'both' | 'terminal' | 'plotter'

export interface Macro {
  id: string
  name: string
  payload: string
  mode: 'text' | 'hex'
  eol: EolKey
}

export interface Settings {
  lang: Lang
  theme: Theme
  port: PortOptions
  view: ViewMode
  layout: Layout
  timestamps: boolean
  echo: boolean
  escapes: boolean
  sendHex: boolean
  eol: EolKey
  plotWindow: number
  macros: Macro[]
}

export const DEFAULT_MACROS: Macro[] = [
  { id: 'm1', name: 'Ping', payload: 'ping', mode: 'text', eol: 'lf' },
  { id: 'm2', name: 'LED on', payload: 'led on', mode: 'text', eol: 'lf' },
  { id: 'm3', name: 'LED off', payload: 'led off', mode: 'text', eol: 'lf' },
  { id: 'm4', name: 'Help', payload: 'help', mode: 'text', eol: 'lf' },
]

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en',
  theme: 'auto',
  port: DEFAULT_PORT,
  view: 'text',
  layout: 'both',
  timestamps: true,
  echo: true,
  escapes: false,
  sendHex: false,
  eol: 'lf',
  plotWindow: 500,
  macros: DEFAULT_MACROS,
}

const KEY = 'web-serial-terminal:v1'

const oneOf = <T,>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d)
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)

/** Merges untrusted stored data onto the defaults, keeping only values we understand. */
export function sanitize(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS
  if (typeof raw !== 'object' || raw === null) return structuredClone(d)
  const r = raw as Record<string, unknown>
  const p = (typeof r.port === 'object' && r.port !== null ? r.port : {}) as Record<string, unknown>
  const baud = typeof p.baudRate === 'number' && p.baudRate >= 50 && p.baudRate <= 12_000_000 ? Math.round(p.baudRate) : d.port.baudRate
  const macros = Array.isArray(r.macros)
    ? r.macros
        .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
        .filter((m) => typeof m.id === 'string' && typeof m.name === 'string' && typeof m.payload === 'string')
        .map((m) => ({
          id: m.id as string,
          name: m.name as string,
          payload: m.payload as string,
          mode: oneOf(m.mode, ['text', 'hex'] as const, 'text'),
          eol: oneOf(m.eol, ['none', 'lf', 'cr', 'crlf'] as const, 'lf'),
        }))
    : structuredClone(d.macros)
  return {
    lang: oneOf(r.lang, ['en', 'uk'] as const, d.lang),
    theme: oneOf(r.theme, ['auto', 'light', 'dark'] as const, d.theme),
    port: {
      baudRate: baud,
      dataBits: oneOf(p.dataBits, [7, 8] as const, 8),
      stopBits: oneOf(p.stopBits, [1, 2] as const, 1),
      parity: oneOf(p.parity, ['none', 'even', 'odd'] as const, 'none'),
      flowControl: oneOf(p.flowControl, ['none', 'hardware'] as const, 'none'),
    },
    view: oneOf(r.view, ['text', 'hex'] as const, d.view),
    layout: oneOf(r.layout, ['both', 'terminal', 'plotter'] as const, d.layout),
    timestamps: bool(r.timestamps, d.timestamps),
    echo: bool(r.echo, d.echo),
    escapes: bool(r.escapes, d.escapes),
    sendHex: bool(r.sendHex, d.sendHex),
    eol: oneOf(r.eol, ['none', 'lf', 'cr', 'crlf'] as const, d.eol),
    plotWindow: oneOf(r.plotWindow, [100, 200, 500, 1000, 2000, 5000] as const, d.plotWindow),
    macros,
  }
}

export function loadSettings(): Settings {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return structuredClone(DEFAULT_SETTINGS)
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Storage blocked or full: settings just won't persist.
  }
}
