import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { DEFAULT_SETTINGS, SUPPORTED_EXTENSIONS, SUBFOLDERS } from '../../shared/config'
import { SessionFolder, PhotoFile } from '../../shared/types'

function getSettings() {
  try {
    const Store = require('electron-store')
    const store = new Store()
    return { ...DEFAULT_SETTINGS, ...store.get('settings', {}) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function isJpeg(filename: string): boolean {
  return SUPPORTED_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext))
}

export function registerFilesystemHandlers(): void {
  // List all session folders across all cameras
  ipcMain.handle('list-sessions', async () => {
    const settings = getSettings()
    const sessions: SessionFolder[] = []

    for (const camera of settings.cameras) {
      const cameraDir = path.join(settings.picturesRoot, camera.folderName)
      if (!fs.existsSync(cameraDir)) continue

      try {
        const entries = fs.readdirSync(cameraDir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          // Match YYYY_MMDD pattern
          if (!/^\d{4}_\d{4}$/.test(entry.name)) continue

          const sessionPath = path.join(cameraDir, entry.name)
          const keepsPath = path.join(sessionPath, SUBFOLDERS.keeps)
          const sharePath = path.join(sessionPath, SUBFOLDERS.share)
          const cullPath = path.join(sessionPath, SUBFOLDERS.cull)

          // Count photos in root of session (not in subfolders)
          let photoCount = 0
          try {
            photoCount = fs.readdirSync(sessionPath)
              .filter(f => isJpeg(f) && fs.statSync(path.join(sessionPath, f)).isFile())
              .length
          } catch { /* empty */ }

          // Also count keeps if no root photos
          let keepsCount = 0
          if (fs.existsSync(keepsPath)) {
            try {
              keepsCount = fs.readdirSync(keepsPath).filter(f => isJpeg(f)).length
            } catch { /* empty */ }
          }

          sessions.push({
            camera: camera.folderName,
            date: entry.name,
            path: sessionPath,
            photoCount: photoCount || keepsCount,
            hasKeeps: fs.existsSync(keepsPath),
            hasShare: fs.existsSync(sharePath),
            hasCull: fs.existsSync(cullPath)
          })
        }
      } catch { /* camera dir read error */ }
    }

    // Sort by date descending
    sessions.sort((a, b) => b.date.localeCompare(a.date))
    return sessions
  })

  // List photos in a folder
  ipcMain.handle('list-photos', async (_event, folderPath: string) => {
    if (!fs.existsSync(folderPath)) return []

    const files = fs.readdirSync(folderPath)
      .filter(f => isJpeg(f) && fs.statSync(path.join(folderPath, f)).isFile())
      .sort()

    return files.map((filename, index): PhotoFile => ({
      filename,
      fullPath: path.join(folderPath, filename),
      index,
      total: files.length
    }))
  })

  // Convert file path to a URL the renderer can display via custom protocol
  ipcMain.handle('get-photo-url', async (_event, filePath: string) => {
    return `photo://${encodeURIComponent(filePath.replace(/\\/g, '/'))}`
  })

  // Finalize cull: move files to cull/ and keeps/ subfolders
  ipcMain.handle('finalize-cull', async (_event, sessionPath: string, cullFiles: string[], keepFiles: string[]) => {
    const cullDir = path.join(sessionPath, SUBFOLDERS.cull)
    const keepsDir = path.join(sessionPath, SUBFOLDERS.keeps)

    fs.mkdirSync(cullDir, { recursive: true })
    fs.mkdirSync(keepsDir, { recursive: true })

    let movedCull = 0
    let movedKeeps = 0

    for (const filename of cullFiles) {
      const src = path.join(sessionPath, filename)
      const dst = path.join(cullDir, filename)
      if (fs.existsSync(src)) {
        fs.renameSync(src, dst)
        movedCull++
      }
    }

    for (const filename of keepFiles) {
      const src = path.join(sessionPath, filename)
      const dst = path.join(keepsDir, filename)
      if (fs.existsSync(src)) {
        fs.renameSync(src, dst)
        movedKeeps++
      }
    }

    return { movedCull, movedKeeps }
  })
}
