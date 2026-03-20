import React, { useState, useEffect, useCallback } from 'react'
import { DetectedCamera } from '../../shared/types'
import { formatDateFolder } from '../../shared/config'
import { useBranding } from '../branding/BrandingProvider'

interface Props {
  onImportComplete: (targetPath: string) => void
}

export default function ImportScreen({ onImportComplete }: Props) {
  const { strings, asset, theme, t } = useBranding()
  const s = strings.import as Record<string, string>
  const [cameras, setCameras] = useState<DetectedCamera[]>([])
  const [scanning, setScanning] = useState(false)
  const [date, setDate] = useState(formatDateFolder())
  const [importing, setImporting] = useState<number | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0, currentFile: '' })
  const [importResult, setImportResult] = useState<{ imported: number; targetPath: string; camera: string; deleted?: boolean } | null>(null)
  const [deleteAfterImport, setDeleteAfterImport] = useState(false)

  const mascot = asset(theme.mascot.importEmpty)
  const bg = asset(theme.backgrounds.import)

  // Load persisted deleteAfterImport preference
  useEffect(() => {
    window.api.getSettings().then(s => {
      if (s.deleteAfterImport !== undefined) setDeleteAfterImport(s.deleteAfterImport)
    })
  }, [])

  // Persist when toggled
  useEffect(() => {
    window.api.saveSettings({ deleteAfterImport })
  }, [deleteAfterImport])

  const scanCameras = useCallback(async () => {
    setScanning(true)
    try {
      const detected = await window.api.detectCameras()
      setCameras(detected)
    } catch (err) {
      console.error('Camera detection failed:', err)
    }
    setScanning(false)
  }, [])

  useEffect(() => {
    scanCameras()
  }, [scanCameras])

  useEffect(() => {
    const cleanup = window.api.onImportProgress((p) => {
      setProgress(p)
    })
    return () => { cleanup() }
  }, [])

  const handleBrowse = async (index: number) => {
    const result = await window.api.browseForFolder()
    if (result) {
      setCameras(prev => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          sourcePath: result.path,
          fileCount: result.fileCount,
          connected: true
        }
        return updated
      })
    }
  }

  const handleImport = async (index: number) => {
    setImporting(index)
    setProgress({ current: 0, total: 0, currentFile: '' })
    setImportResult(null)
    try {
      const result = await window.api.importPhotos(index, date, deleteAfterImport)
      setImportResult(result)
    } catch (err) {
      console.error('Import failed:', err)
    }
    setImporting(null)
  }

  return (
    <div className="screen" style={bg ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover' } : undefined}>
      <div className="section-header">
        <h2>{s.heading}</h2>
        <button className="btn btn-secondary" onClick={scanCameras} disabled={scanning}>
          {scanning ? s.scanning : s.refreshCameras}
        </button>
      </div>

      <div className="date-input" style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 13, color: 'var(--text-dim)' }}>{s.folderDate}</label>
        <input
          type="text"
          value={date}
          onChange={e => setDate(e.target.value)}
          placeholder="YYYY_MMDD"
          style={{ width: 140 }}
        />
        <button className="btn btn-secondary" onClick={() => setDate(formatDateFolder())}>
          {s.today}
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={deleteAfterImport}
            onChange={e => setDeleteAfterImport(e.target.checked)}
          />
          {s.deleteAfterImport}
        </label>
      </div>

      <div className="camera-list">
        {cameras.length === 0 && !scanning && (
          <div className="empty-state">
            {mascot && <img src={mascot} alt="" style={{ height: 120, marginBottom: 16 }} />}
            <h3>{s.noCameras}</h3>
            <p>{s.noCamerasHint}</p>
          </div>
        )}

        {cameras.map((cam, i) => (
          <div className="camera-card" key={i}>
            <div className="camera-info">
              <h3>{cam.config.name}</h3>
              <div className={`camera-status ${cam.connected ? 'connected' : ''}`}>
                {cam.connected
                  ? `${s.connected} — ${cam.fileCount >= 0 ? t(s.photosFound, { count: cam.fileCount }) : s.ready}`
                  : s.notDetected
                }
              </div>
              {cam.sourcePath && (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                  {cam.sourcePath}
                </div>
              )}
              {importing === i && progress.total > 0 && (
                <>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                    {progress.current} / {progress.total} — {progress.currentFile}
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!cam.connected && (
                <button className="btn btn-secondary" onClick={() => handleBrowse(i)}>
                  {s.browse}
                </button>
              )}
              <button
                className="btn btn-primary"
                disabled={!cam.connected || importing !== null}
                onClick={() => handleImport(i)}
              >
                {importing === i ? s.importing : s.importBtn}
              </button>
            </div>
          </div>
        ))}
      </div>

      {importResult && (
        <div className="card" style={{ marginTop: 24, borderColor: 'var(--success)' }}>
          <div className="card-header" style={{ color: 'var(--success)' }}>
            {s.importComplete}
          </div>
          <p>{t(s.importedCount, { count: importResult.imported, camera: importResult.camera })}</p>
          {importResult.deleted && (
            <p style={{ fontSize: 13, color: 'var(--success)', marginTop: 4 }}>
              {s.deletedFromDevice}
            </p>
          )}
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
            {importResult.targetPath}
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => onImportComplete(importResult.targetPath)}
          >
            {s.startCulling}
          </button>
        </div>
      )}
    </div>
  )
}
