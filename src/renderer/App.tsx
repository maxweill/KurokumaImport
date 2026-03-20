import React, { useState } from 'react'
import { Screen } from '../shared/types'
import { useBranding } from './branding/BrandingProvider'
import ImportScreen from './screens/ImportScreen'
import CullScreen from './screens/CullScreen'
import SettingsScreen from './screens/SettingsScreen'

export default function App() {
  const [screen, setScreen] = useState<Screen>('import')
  const [sessionPath, setSessionPath] = useState<string>('')
  const { strings, asset, theme } = useBranding()

  const openCullSession = (path: string) => {
    setSessionPath(path)
    setScreen('cull')
  }

  const navMascot = asset(theme.mascot.nav)
  const appBg = asset(theme.backgrounds.app)

  return (
    <div style={appBg ? { backgroundImage: `url(${appBg})`, backgroundSize: 'cover', backgroundPosition: 'center', height: '100vh', display: 'flex', flexDirection: 'column' } : undefined}>
      <nav className="nav">
        {navMascot && <img src={navMascot} alt="" style={{ height: 32, marginRight: 8 }} />}
        <span className="nav-title">{strings.appTitle}</span>
        <div className="nav-tabs">
          {(['import', 'cull', 'settings'] as Screen[]).map(s => (
            <button
              key={s}
              className={`nav-tab ${screen === s ? 'active' : ''}`}
              onClick={() => setScreen(s)}
            >
              {strings.nav[s]}
            </button>
          ))}
        </div>
      </nav>

      {screen === 'import' && (
        <ImportScreen onImportComplete={(path) => openCullSession(path)} />
      )}
      {screen === 'cull' && (
        <CullScreen
          sessionPath={sessionPath}
          onSelectSession={openCullSession}
        />
      )}
      {screen === 'settings' && <SettingsScreen />}
    </div>
  )
}
