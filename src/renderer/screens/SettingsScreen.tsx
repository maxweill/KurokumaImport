import React, { useState, useEffect, useCallback } from 'react'
import { AppSettings, CameraConfig, DetectedCamera } from '../../shared/types'
import { useBranding } from '../branding/BrandingProvider'

export default function SettingsScreen() {
  const { strings, asset, theme } = useBranding()
  const s = strings.settings as Record<string, string>
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [detected, setDetected] = useState<DetectedCamera[]>([])
  const [scanning, setScanning] = useState(false)

  const bg = asset(theme.backgrounds.settings)

  useEffect(() => {
    window.api.getSettings().then(setSettings)
  }, [])

  const scanDevices = useCallback(async () => {
    setScanning(true)
    try {
      const cameras = await window.api.detectCameras()
      setDetected(cameras)
    } catch { /* ignore */ }
    setScanning(false)
  }, [])

  useEffect(() => {
    scanDevices()
  }, [scanDevices])

  const handleSave = async () => {
    if (!settings) return
    await window.api.saveSettings(settings as unknown as Record<string, unknown>)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleBrowseRoot = async () => {
    const dir = await window.api.browseForDirectory()
    if (dir && settings) {
      setSettings({ ...settings, picturesRoot: dir })
    }
  }

  const addCamera = () => {
    if (!settings) return
    const cam: CameraConfig = { name: '', folderName: '', deviceMatch: '' }
    setSettings({ ...settings, cameras: [...settings.cameras, cam] })
  }

  const removeCamera = (index: number) => {
    if (!settings) return
    const cameras = settings.cameras.filter((_, i) => i !== index)
    setSettings({ ...settings, cameras })
  }

  const addDetectedCamera = (cam: DetectedCamera) => {
    if (!settings) return
    const already = settings.cameras.some(c => c.name === cam.config.name)
    if (already) return
    const newCam: CameraConfig = {
      name: cam.config.name,
      folderName: cam.config.folderName,
      deviceMatch: cam.config.deviceMatch || cam.config.name.toLowerCase()
    }
    setSettings({ ...settings, cameras: [...settings.cameras, newCam] })
  }

  if (!settings) return <div className="screen">{s.loading}</div>

  return (
    <div className="screen" style={bg ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover' } : undefined}>
      <h2 style={{ marginBottom: 24 }}>{s.heading}</h2>
      <div className="settings-form">
        <div className="form-group">
          <label>{s.picturesRoot}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={settings.picturesRoot}
              onChange={e => setSettings({ ...settings, picturesRoot: e.target.value })}
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" onClick={handleBrowseRoot}>
              {s.browse}
            </button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{s.detectedDevices}</span>
            <button className="btn btn-secondary" onClick={scanDevices} disabled={scanning} style={{ fontSize: 12, padding: '4px 10px' }}>
              {scanning ? s.scanning : s.refresh}
            </button>
          </div>
          {detected.length === 0 && !scanning && (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', padding: '12px 0' }}>
              {s.noDevicesDetected}
            </p>
          )}
          {detected.filter(d => d.connected).map((cam, i) => {
            const alreadySaved = settings.cameras.some(c =>
              c.name === cam.config.name || c.deviceMatch === cam.config.deviceMatch
            )
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{cam.config.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    {cam.type} {cam.fileCount >= 0 ? `— ${cam.fileCount} photos` : ''}
                  </div>
                </div>
                {alreadySaved ? (
                  <span style={{ fontSize: 12, color: 'var(--success)' }}>{s.alreadySaved}</span>
                ) : (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => addDetectedCamera(cam)}
                  >
                    {s.quickAdd}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{s.cameras}</span>
            <button className="btn btn-secondary" onClick={addCamera} style={{ fontSize: 12, padding: '4px 10px' }}>
              {s.addCamera}
            </button>
          </div>
          {settings.cameras.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', padding: '12px 0' }}>
              {s.noCamerasHint}
            </p>
          )}
          {settings.cameras.map((cam, i) => (
            <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: i < settings.cameras.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="form-group">
                <label>{s.cameraName}</label>
                <input
                  type="text"
                  value={cam.name}
                  onChange={e => {
                    const cameras = [...settings.cameras]
                    cameras[i] = { ...cameras[i], name: e.target.value }
                    setSettings({ ...settings, cameras })
                  }}
                />
              </div>
              <div className="form-group">
                <label>{s.folderName}</label>
                <input
                  type="text"
                  value={cam.folderName}
                  onChange={e => {
                    const cameras = [...settings.cameras]
                    cameras[i] = { ...cameras[i], folderName: e.target.value }
                    setSettings({ ...settings, cameras })
                  }}
                />
              </div>
              <div className="form-group">
                <label>{s.deviceMatch}</label>
                <input
                  type="text"
                  value={cam.deviceMatch || ''}
                  placeholder={s.deviceMatchHint}
                  onChange={e => {
                    const cameras = [...settings.cameras]
                    cameras[i] = { ...cameras[i], deviceMatch: e.target.value || undefined }
                    setSettings({ ...settings, cameras })
                  }}
                />
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '4px 10px', color: 'var(--danger)' }}
                onClick={() => removeCamera(i)}
              >
                {s.removeCamera}
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={handleSave}>
            {s.save}
          </button>
          {saved && <span style={{ color: 'var(--success)', fontSize: 13 }}>{s.saved}</span>}
        </div>
      </div>
    </div>
  )
}
