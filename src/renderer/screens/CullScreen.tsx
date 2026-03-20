import React, { useState, useEffect, useCallback, useRef } from 'react'
import { PhotoFile, CullStatus, SessionFolder } from '../../shared/types'
import { useBranding } from '../branding/BrandingProvider'
import SessionPicker from '../components/SessionPicker'

interface Props {
  sessionPath: string
  onSelectSession: (path: string) => void
}

export default function CullScreen({ sessionPath, onSelectSession }: Props) {
  const { strings, asset, theme, t } = useBranding()
  const s = strings.cull as Record<string, string>
  const [photos, setPhotos] = useState<PhotoFile[]>([])
  const [statuses, setStatuses] = useState<Map<string, CullStatus>>(new Map())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [history, setHistory] = useState<{ filename: string; prevStatus: CullStatus }[]>([])
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Preloaded image cache
  const preloadCache = useRef<Map<string, string>>(new Map())

  // Zoom & pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const panOffset = useRef({ x: 0, y: 0 })

  const loadPhotos = useCallback(async (folder: string) => {
    const photoList: PhotoFile[] = await window.api.listPhotos(folder)
    setPhotos(photoList)
    setStatuses(new Map(photoList.map(p => [p.filename, 'unmarked' as CullStatus])))
    setCurrentIndex(0)
    setHistory([])
    setShowSummary(false)
  }, [])

  useEffect(() => {
    if (sessionPath) {
      loadPhotos(sessionPath)
    }
  }, [sessionPath, loadPhotos])

  // Preload adjacent images
  useEffect(() => {
    if (photos.length === 0) return
    const indicesToPreload = [currentIndex - 1, currentIndex, currentIndex + 1, currentIndex + 2]
    for (const idx of indicesToPreload) {
      if (idx >= 0 && idx < photos.length) {
        const photo = photos[idx]
        if (!preloadCache.current.has(photo.fullPath)) {
          const img = new Image()
          window.api.getPhotoUrl(photo.fullPath).then(url => {
            img.src = url
            preloadCache.current.set(photo.fullPath, url)
          })
        }
      }
    }
  }, [currentIndex, photos])

  const [currentUrl, setCurrentUrl] = useState('')
  useEffect(() => {
    if (photos.length > 0 && currentIndex < photos.length) {
      const photo = photos[currentIndex]
      const cached = preloadCache.current.get(photo.fullPath)
      if (cached) {
        setCurrentUrl(cached)
      } else {
        window.api.getPhotoUrl(photo.fullPath).then(url => {
          setCurrentUrl(url)
          preloadCache.current.set(photo.fullPath, url)
        })
      }
    }
    // Reset zoom/pan when changing photos
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [currentIndex, photos])

  // Scroll to zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(prev => Math.max(1, Math.min(10, prev + delta * prev)))
  }, [])

  // Click-drag to pan (only when zoomed)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (zoom <= 1) return
    isPanning.current = true
    panStart.current = { x: e.clientX, y: e.clientY }
    panOffset.current = { ...pan }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [zoom, pan])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return
    setPan({
      x: panOffset.current.x + (e.clientX - panStart.current.x),
      y: panOffset.current.y + (e.clientY - panStart.current.y)
    })
  }, [])

  const handlePointerUp = useCallback(() => {
    isPanning.current = false
  }, [])

  // Double-click to toggle zoom
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      setZoom(1)
      setPan({ x: 0, y: 0 })
    } else {
      setZoom(3)
      // Center zoom on click point
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const cx = e.clientX - rect.left - rect.width / 2
        const cy = e.clientY - rect.top - rect.height / 2
        setPan({ x: -cx * 2, y: -cy * 2 })
      }
    }
  }, [zoom])

  const setStatus = useCallback((status: CullStatus) => {
    if (photos.length === 0) return
    const filename = photos[currentIndex].filename
    const prevStatus = statuses.get(filename) || 'unmarked'

    setHistory(prev => [...prev, { filename, prevStatus }])
    setStatuses(prev => {
      const next = new Map(prev)
      next.set(filename, status)
      return next
    })

    // Auto-advance to next photo
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }, [currentIndex, photos, statuses])

  const undo = useCallback(() => {
    if (history.length === 0) return
    const last = history[history.length - 1]
    setHistory(prev => prev.slice(0, -1))
    setStatuses(prev => {
      const next = new Map(prev)
      next.set(last.filename, last.prevStatus)
      return next
    })
    // Go back to the photo we just undid
    const idx = photos.findIndex(p => p.filename === last.filename)
    if (idx >= 0) setCurrentIndex(idx)
  }, [history, photos])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showSummary) return

      switch (e.key) {
        case 'Escape':
          onSelectSession('')
          break
        case 'ArrowLeft':
          setCurrentIndex(prev => Math.max(0, prev - 1))
          break
        case 'ArrowRight':
          setCurrentIndex(prev => Math.min(photos.length - 1, prev + 1))
          break
        case 'x':
        case 'X':
        case 'Delete':
          setStatus('cull')
          break
        case ' ':
        case 'Enter':
          e.preventDefault()
          setStatus('keep')
          break
        case 'z':
        case 'Z':
          if (e.ctrlKey || e.metaKey) {
            undo()
          } else {
            undo()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [photos.length, setStatus, undo, showSummary])

  const handleFinalize = async () => {
    setFinalizing(true)
    const cullFiles: string[] = []
    const keepFiles: string[] = []

    statuses.forEach((status, filename) => {
      if (status === 'cull') cullFiles.push(filename)
      else keepFiles.push(filename) // unmarked treated as keep
    })

    await window.api.finalizeCull(sessionPath, cullFiles, keepFiles)
    setFinalizing(false)

    // Done — go back to session picker
    onSelectSession('')
  }

  // If no session selected, show session picker
  if (!sessionPath) {
    return <SessionPicker onSelect={onSelectSession} mode="cull" />
  }

  if (photos.length === 0) {
    const mascot = asset(theme.mascot.cullEmpty)
    return (
      <div className="screen">
        <div className="empty-state">
          {mascot && <img src={mascot} alt="" style={{ height: 120, marginBottom: 16 }} />}
          <h3>{s.noPhotos}</h3>
          <p>{s.noPhotosHint}</p>
          <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => onSelectSession('')}>
            {s.pickDifferent}
          </button>
        </div>
      </div>
    )
  }

  const currentPhoto = photos[currentIndex]
  const currentStatus = statuses.get(currentPhoto.filename) || 'unmarked'
  const cullCount = Array.from(statuses.values()).filter(s => s === 'cull').length
  const keepCount = Array.from(statuses.values()).filter(s => s === 'keep').length
  const unmarkedCount = photos.length - cullCount - keepCount
  const unmarkedPhotos = photos.filter(p => (statuses.get(p.filename) || 'unmarked') === 'unmarked')

  if (showSummary) {
    return (
      <div className="screen">
        <div className="card" style={{ maxWidth: 500, margin: '60px auto' }}>
          <div className="card-header">{s.summaryHeading}</div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>
              {t(s.keepsCount, { count: keepCount + unmarkedCount })}
            </p>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)', marginTop: 4 }}>
              {t(s.culledCount, { count: cullCount })}
            </p>
            {unmarkedCount > 0 && (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>
                  {t(s.unmarkedNote, { count: unmarkedCount })}
                </p>
                <p style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>{s.unmarkedList}</p>
                <div style={{ maxHeight: 160, overflowY: 'auto', marginTop: 4 }}>
                  {unmarkedPhotos.map(p => {
                    const idx = photos.indexOf(p)
                    return (
                      <button
                        key={p.filename}
                        className="btn btn-secondary"
                        style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4, fontSize: 12, padding: '4px 8px' }}
                        onClick={() => { setCurrentIndex(idx); setShowSummary(false) }}
                      >
                        {p.filename}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowSummary(false)}>
              {s.goBack}
            </button>
            <button className="btn btn-primary" onClick={handleFinalize} disabled={finalizing}>
              {finalizing ? s.movingFiles : s.confirmMove}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen-full">
      <div className="viewer">
        <div
          className="viewer-image-container"
          ref={containerRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: zoom > 1 ? (isPanning.current ? 'grabbing' : 'grab') : 'default' }}
        >
          <img
            ref={imgRef}
            src={currentUrl}
            className="viewer-image"
            draggable={false}
            alt={currentPhoto.filename}
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transition: isPanning.current ? 'none' : 'transform 0.1s ease-out'
            }}
          />
          {currentStatus === 'cull' && (
            <div className="cull-overlay">
              <span className="cull-overlay-text">{s.culledOverlay}</span>
            </div>
          )}
          {zoom > 1 && (
            <div className="zoom-indicator">{Math.round(zoom * 100)}%</div>
          )}
        </div>
        <div className="viewer-toolbar">
          <div className="viewer-info">
            <span className="viewer-filename">{currentPhoto.filename}</span>
            <span className="viewer-counter">
              {currentIndex + 1} / {photos.length}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {keepCount} {s.keeps} · {cullCount} {s.culled} · {unmarkedCount} {s.unmarked}
            </span>
          </div>
          <div className="viewer-actions">
            <button
              className="btn btn-secondary"
              onClick={() => onSelectSession('')}
            >
              {s.leave}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => setStatus('cull')}
            >
              {s.cullBtn} <span className="keyhint">X</span>
            </button>
            <button
              className="btn btn-success"
              onClick={() => setStatus('keep')}
            >
              {s.keepBtn} <span className="keyhint">Space</span>
            </button>
            <button className="btn btn-secondary" onClick={undo} disabled={history.length === 0}>
              {s.undo} <span className="keyhint">Z</span>
            </button>
            <button className="btn btn-primary" onClick={() => setShowSummary(true)}>
              {s.done}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
