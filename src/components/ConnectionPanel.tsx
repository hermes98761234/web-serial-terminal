import { useState } from 'react'
import { BAUD_RATES, describePort, validBaud, webSerialSupported, type PortOptions } from '../lib/serial'
import type { T } from '../i18n'
import type { Controller } from '../useSession'

interface Props {
  ctrl: Controller
  port: PortOptions
  onPort(p: PortOptions): void
  t: T
}

function Led({ on, label }: { on: boolean | undefined; label: string }) {
  return (
    <span className={`led ${on ? 'on' : ''}`}>
      <i />
      {label}
    </span>
  )
}

export default function ConnectionPanel({ ctrl, port, onPort, t }: Props) {
  const [baudText, setBaudText] = useState(String(port.baudRate))
  const supported = webSerialSupported()
  const connected = ctrl.status === 'connected'
  const busy = ctrl.status !== 'idle'
  const set = <K extends keyof PortOptions>(k: K, v: PortOptions[K]) => onPort({ ...port, [k]: v })
  const baudBad = !validBaud(Number(baudText))

  return (
    <section className="section">
      <h3>{t('Connection')}</h3>
      {!supported && <p className="hint warn-text">{t('Web Serial is not available in this browser. Use Chrome, Edge or Opera on desktop, over HTTPS. The demo mode works everywhere.')}</p>}
      <div className="grid2">
        <label className="field">
          <span>{t('Baud rate')}</span>
          <input
            type="text"
            inputMode="numeric"
            list="bauds"
            className={baudBad ? 'bad' : ''}
            value={baudText}
            disabled={busy}
            onChange={(e) => {
              setBaudText(e.target.value)
              if (validBaud(Number(e.target.value))) set('baudRate', Number(e.target.value))
            }}
          />
          <datalist id="bauds">
            {BAUD_RATES.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>{t('Data bits')}</span>
          <select value={port.dataBits} disabled={busy} onChange={(e) => set('dataBits', Number(e.target.value) as 7 | 8)}>
            <option value={8}>8</option>
            <option value={7}>7</option>
          </select>
        </label>
        <label className="field">
          <span>{t('Parity')}</span>
          <select value={port.parity} disabled={busy} onChange={(e) => set('parity', e.target.value as PortOptions['parity'])}>
            <option value="none">{t('None')}</option>
            <option value="even">{t('Even')}</option>
            <option value="odd">{t('Odd')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('Stop bits')}</span>
          <select value={port.stopBits} disabled={busy} onChange={(e) => set('stopBits', Number(e.target.value) as 1 | 2)}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
        <label className="field">
          <span>{t('Flow control')}</span>
          <select value={port.flowControl} disabled={busy} onChange={(e) => set('flowControl', e.target.value as PortOptions['flowControl'])}>
            <option value="none">{t('None')}</option>
            <option value="hardware">RTS/CTS</option>
          </select>
        </label>
      </div>
      <div className="row">
        {!connected ? (
          <>
            <button className="primary" disabled={!supported || busy || baudBad} onClick={() => void ctrl.connect(port, false)}>
              {t('Connect…')}
            </button>
            <button disabled={busy} onClick={() => void ctrl.connect(port, true)}>
              {t('Demo mode')}
            </button>
          </>
        ) : (
          <button className="primary" onClick={() => void ctrl.disconnect()}>
            {t('Disconnect')}
          </button>
        )}
      </div>
      <p className="hint">
        {connected
          ? ctrl.demo
            ? t('Demo device connected. Nothing leaves your browser.')
            : t('Connected: {0}', describePort(port))
          : t('Not connected. Settings: {0}', describePort(port))}
      </p>
      <div className="row">
        <label className="chk">
          <input type="checkbox" checked={ctrl.dtr} disabled={!connected} onChange={(e) => void ctrl.setDtr(e.target.checked)} />
          DTR
        </label>
        <label className="chk">
          <input type="checkbox" checked={ctrl.rts} disabled={!connected} onChange={(e) => void ctrl.setRts(e.target.checked)} />
          RTS
        </label>
        <button className="small" disabled={!connected} title={t('Toggle DTR low for 100 ms, which resets most Arduino boards')} onClick={() => void ctrl.pulseReset()}>
          {t('Reset pulse')}
        </button>
        <button className="small" disabled={!connected} onClick={() => void ctrl.sendBreak()}>
          {t('Break')}
        </button>
      </div>
      <div className="row leds" aria-label={t('Input lines')}>
        <Led on={ctrl.signals?.clearToSend} label="CTS" />
        <Led on={ctrl.signals?.dataSetReady} label="DSR" />
        <Led on={ctrl.signals?.dataCarrierDetect} label="DCD" />
        <Led on={ctrl.signals?.ringIndicator} label="RI" />
      </div>
    </section>
  )
}
