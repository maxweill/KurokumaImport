import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Import
  detectCameras: () => ipcRenderer.invoke('detect-cameras'),
  importPhotos: (cameraIndex: number, date: string, deleteAfterImport: boolean) =>
    ipcRenderer.invoke('import-photos', cameraIndex, date, deleteAfterImport),
  onImportProgress: (callback: (progress: { current: number; total: number; currentFile: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { current: number; total: number; currentFile: string }) => callback(progress)
    ipcRenderer.on('import-progress', handler)
    return () => ipcRenderer.removeListener('import-progress', handler)
  },
  browseForFolder: () => ipcRenderer.invoke('browse-for-folder'),
  browseForDirectory: () => ipcRenderer.invoke('browse-for-directory'),

  // Filesystem
  listSessions: () => ipcRenderer.invoke('list-sessions'),
  listPhotos: (folderPath: string) => ipcRenderer.invoke('list-photos', folderPath),
  getPhotoUrl: (filePath: string) => ipcRenderer.invoke('get-photo-url', filePath),
  finalizeCull: (sessionPath: string, cullFiles: string[], keepFiles: string[]) =>
    ipcRenderer.invoke('finalize-cull', sessionPath, cullFiles, keepFiles),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('save-settings', settings)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
