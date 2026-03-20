import { app, BrowserWindow, protocol, net } from 'electron'
import path from 'path'
import { registerImportHandlers } from './ipc/import'
import { registerFilesystemHandlers } from './ipc/filesystem'
import { registerSettingsHandlers } from './ipc/settings'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: '',
    icon: path.join(__dirname, '../../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Register custom protocol to serve local image files
  protocol.handle('photo', (request) => {
    // photo://C:/path/to/image.jpg → file path
    const filePath = decodeURIComponent(request.url.replace('photo://', ''))
    return net.fetch('file:///' + filePath)
  })

  registerImportHandlers()
  registerFilesystemHandlers()
  registerSettingsHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})
