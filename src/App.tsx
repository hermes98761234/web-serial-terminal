import { useEffect, useState } from 'react'
import { tr, type T } from './i18n'
import { loadSettings, saveSettings, type Lang, type Layout, type Settings, type Theme } from './lib/settings'
import { useSession } from './useSession'
import ConnectionPanel from './components/ConnectionPanel'
import Macros from './components/Macros'
import Plotter from './components/Plotter'
import SendBar from './components/SendBar'
import TerminalView from './components/TerminalView'

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const ctrl = useSession()
  const t: T = (s, ...a) => tr(settings.lang, s, ...a)
  const patch = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }))

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = settings.theme
    root.lang = settings.lang
  }, [settings.theme, settings.lang])

  const status = ctrl.status === 'connected' ? (ctrl.demo ? t('Demo') : t('Connected')) : ctrl.status === 'connecting' ? t('Connecting…') : t('Disconnected')

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('Web Serial Terminal')}</span>
        <span className="hint">{t('Arduino serial monitor and plotter in your browser.')}</span>
        <span className="spacer" />
        <span className={`pill ${ctrl.status}`}>{status}</span>
      </header>
      <div className="body">
        <aside className="side">
          <div className="panel">
            <ConnectionPanel ctrl={ctrl} port={settings.port} onPort={(port) => patch({ port })} t={t} />
            <Macros ctrl={ctrl} settings={settings} onMacros={(macros) => patch({ macros })} t={t} />
            <section className="section">
              <h3>{t('Settings')}</h3>
              <div className="grid2">
                <label className="field" style={{ gridColumn: '1 / -1' }}>
                  <span>{t('Layout')}</span>
                  <select value={settings.layout} onChange={(e) => patch({ layout: e.target.value as Layout })}>
                    <option value="both">{t('Terminal and plotter')}</option>
                    <option value="terminal">{t('Terminal only')}</option>
                    <option value="plotter">{t('Plotter only')}</option>
                  </select>
                </label>
                <label className="field">
                  <span>{t('Language')}</span>
                  <select value={settings.lang} onChange={(e) => patch({ lang: e.target.value as Lang })}>
                    <option value="en">English</option>
                    <option value="uk">Українська</option>
                  </select>
                </label>
                <label className="field">
                  <span>{t('Theme')}</span>
                  <select value={settings.theme} onChange={(e) => patch({ theme: e.target.value as Theme })}>
                    <option value="auto">{t('System')}</option>
                    <option value="light">{t('Light')}</option>
                    <option value="dark">{t('Dark')}</option>
                  </select>
                </label>
              </div>
            </section>
          </div>
        </aside>
        <main className="main">
          {settings.layout !== 'terminal' && <Plotter ctrl={ctrl} settings={settings} onSettings={patch} t={t} />}
          {settings.layout !== 'plotter' && <TerminalView ctrl={ctrl} settings={settings} onSettings={patch} t={t} />}
          <SendBar ctrl={ctrl} settings={settings} onSettings={patch} t={t} />
        </main>
      </div>
      <p className="hint foot">
        {t('Everything runs in your browser. Serial data never leaves this page.')}{' '}
        <a href="https://github.com/hermes98761234/web-serial-terminal">{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}
