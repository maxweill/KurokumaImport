// Shared TypeScript types for KurokumaImport

export interface CameraConfig {
  name: string
  folderName: string
  /** Substring to match against device name or volume label (case-insensitive) */
  deviceMatch?: string
}

/** The detected connection type — determined at scan time, not configured */
export type ConnectionType = 'mass-storage' | 'mtp' | 'manual'

export interface ImportSession {
  camera: CameraConfig
  sourcePath: string
  targetPath: string
  date: string // YYYY_MMDD format
  fileCount: number
}

export interface PhotoFile {
  filename: string
  fullPath: string
  index: number
  total: number
}

export type CullStatus = 'unmarked' | 'keep' | 'cull'

export interface CullState {
  filename: string
  status: CullStatus
}

export interface SessionFolder {
  camera: string
  date: string
  path: string
  photoCount: number
  hasKeeps: boolean
  hasShare: boolean
  hasCull: boolean
}

export type Screen = 'import' | 'cull' | 'settings'

export interface DetectedCamera {
  config: CameraConfig
  type: ConnectionType
  sourcePath: string
  fileCount: number
  connected: boolean
}

export interface ImportProgress {
  current: number
  total: number
  currentFile: string
}

export interface AppSettings {
  picturesRoot: string
  cameras: CameraConfig[]
  deleteAfterImport: boolean
}
