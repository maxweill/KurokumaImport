import { AppSettings, CameraConfig } from './types'

export const DEFAULT_CAMERAS: CameraConfig[] = []

export const DEFAULT_SETTINGS: AppSettings = {
  picturesRoot: 'C:\\Users\\maxwe\\OneDrive\\Pictures',
  cameras: DEFAULT_CAMERAS,
  deleteAfterImport: false
}

export const SUBFOLDERS = {
  cull: 'cull',
  keeps: 'keeps',
  share: 'share'
} as const

export const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg'] as const

// Format today's date as YYYY_MMDD
export function formatDateFolder(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}_${m}${d}`
}
