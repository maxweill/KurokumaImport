import { ipcMain, BrowserWindow, dialog } from 'electron'
import { DEFAULT_SETTINGS } from '../../shared/config'

function getStore() {
  const Store = require('electron-store').default
  return new Store()
}

function getSettings() {
  try {
    const store = getStore()
    return { ...DEFAULT_SETTINGS, ...store.get('settings', {}) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('get-settings', async () => {
    return getSettings()
  })

  ipcMain.handle('save-settings', async (_event, newSettings: Record<string, unknown>) => {
    try {
      const store = getStore()
      store.set('settings', { ...getSettings(), ...newSettings })
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('browse-for-directory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
