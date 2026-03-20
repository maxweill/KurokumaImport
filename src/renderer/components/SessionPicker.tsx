import React, { useState, useEffect } from 'react'
import { SessionFolder } from '../../shared/types'
import { useBranding } from '../branding/BrandingProvider'

interface Props {
  onSelect: (path: string) => void
  mode: 'cull'
}

export default function SessionPicker({ onSelect, mode }: Props) {
  const { strings, asset, theme } = useBranding()
  const s = strings.cull as Record<string, string>
  const ss = strings.session as Record<string, string>
  const [sessions, setSessions] = useState<SessionFolder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    window.api.listSessions().then((s: SessionFolder[]) => {
      setSessions(s)
      setLoading(false)
    })
  }, [])

  const filtered = sessions.filter(s => s.photoCount > 0 && !s.hasKeeps)
  const other = sessions.filter(s => !filtered.includes(s))
  const mascot = asset(theme.mascot.sessionEmpty)

  return (
    <div className="screen">
      <div className="section-header">
        <h2>{s.selectSession}</h2>
      </div>

      {loading && <p>Loading sessions...</p>}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          {mascot && <img src={mascot} alt="" style={{ height: 120, marginBottom: 16 }} />}
          <h3>{s.noSessions}</h3>
          <p>{s.noSessionsHint}</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="session-grid">
          {filtered.map(sess => (
            <div
              key={sess.path}
              className="session-card"
              onClick={() => onSelect(sess.path)}
            >
              <div className="session-camera">{sess.camera}</div>
              <div className="session-date">{sess.date}</div>
              <div className="session-meta">{sess.photoCount} {ss.photos}</div>
              <div className="session-badges">
                {sess.hasKeeps && <span className="badge badge-keeps">{ss.keeps}</span>}
                {sess.hasShare && <span className="badge badge-share">{ss.shared}</span>}
                {sess.hasCull && <span className="badge badge-cull">{ss.culled}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {other.length > 0 && (
        <>
          <h3 style={{ marginTop: 32, marginBottom: 16, color: 'var(--text-dim)' }}>
            {s.otherSessions}
          </h3>
          <div className="session-grid">
            {other.map(sess => (
              <div
                key={sess.path}
                className="session-card"
                onClick={() => onSelect(sess.path)}
              >
                <div className="session-camera">{sess.camera}</div>
                <div className="session-date">{sess.date}</div>
                <div className="session-meta">{sess.photoCount} {ss.photos}</div>
                <div className="session-badges">
                  {sess.hasKeeps && <span className="badge badge-keeps">{ss.keeps}</span>}
                  {sess.hasShare && <span className="badge badge-share">{ss.shared}</span>}
                  {sess.hasCull && <span className="badge badge-cull">{ss.culled}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
