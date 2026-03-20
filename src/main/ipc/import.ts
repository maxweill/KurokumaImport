import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import { execSync, exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { DEFAULT_SETTINGS, formatDateFolder, SUPPORTED_EXTENSIONS } from '../../shared/config'
import { DetectedCamera, CameraConfig, ConnectionType } from '../../shared/types'

let settingsCache = { ...DEFAULT_SETTINGS }

function getSettings() {
  try {
    const Store = require('electron-store').default
    const store = new Store()
    return { ...DEFAULT_SETTINGS, ...store.get('settings', {}) }
  } catch {
    return settingsCache
  }
}

// Detect mass-storage cameras (drives with DCIM folder)
// Checks both removable drives AND all drive letters for DCIM folders
function detectMassStorageCameras(): DetectedCamera[] {
  const settings = getSettings()
  const results: DetectedCamera[] = []

  try {
    // Write script to temp file to avoid $_ escaping issues
    const tmpScript = path.join(app.getPath('temp'), 'ms_detect.ps1')
    fs.writeFileSync(tmpScript, 'Get-Volume | Where-Object { $_.DriveLetter } | Select-Object -Property DriveLetter,FileSystemLabel,DriveType | ConvertTo-Json', 'utf8')
    const output = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpScript}"`,
      { encoding: 'utf8', timeout: 10000 }
    )

    const volumes = JSON.parse(output || '[]')
    const volumeList = Array.isArray(volumes) ? volumes : [volumes]

    for (const vol of volumeList) {
      if (!vol.DriveLetter) continue
      const drivePath = `${vol.DriveLetter}:\\`
      const dcimPath = path.join(drivePath, 'DCIM')

      if (fs.existsSync(dcimPath)) {
        const jpegFiles = findJpegs(dcimPath)
        // Try to match to a camera config by volume label or deviceMatch
        const matchedConfig = settings.cameras.find((c: CameraConfig) =>
          c.deviceMatch && (
            (vol.FileSystemLabel || '').toLowerCase().includes(c.deviceMatch.toLowerCase()) ||
            c.deviceMatch.toLowerCase().includes((vol.FileSystemLabel || '').toLowerCase())
          )
        )
        if (matchedConfig) {
          results.push({
            config: matchedConfig,
            type: 'mass-storage' as ConnectionType,
            sourcePath: dcimPath,
            fileCount: jpegFiles.length,
            connected: true
          })
        } else {
          // Unmatched DCIM drive — show as generic camera
          results.push({
            config: { name: vol.FileSystemLabel || `Drive ${vol.DriveLetter}`, folderName: vol.FileSystemLabel || `Drive_${vol.DriveLetter}` },
            type: 'mass-storage' as ConnectionType,
            sourcePath: dcimPath,
            fileCount: jpegFiles.length,
            connected: true
          })
        }
      }
    }
  } catch {
    // Fallback: just check common drive letters directly
    for (const letter of ['D', 'E', 'F', 'G', 'H', 'I']) {
      const dcimPath = `${letter}:\\DCIM`
      try {
        if (fs.existsSync(dcimPath)) {
          const jpegFiles = findJpegs(dcimPath)
          results.push({
            config: { name: `Drive ${letter}`, folderName: `Drive_${letter}` },
            type: 'mass-storage' as ConnectionType,
            sourcePath: dcimPath,
            fileCount: jpegFiles.length,
            connected: true
          })
        }
      } catch { /* drive not accessible */ }
    }
  }

  return results
}

// Detect MTP/PTP devices using Shell.Application
// Finds cameras and portable devices that show up in My Computer but not as drive letters
function detectMtpCameras(): Promise<DetectedCamera[]> {
  const settings = getSettings()
  return new Promise((resolve) => {
    // Write script to a temp file to avoid PowerShell escaping issues with $_ and special chars
    const tmpScript = path.join(app.getPath('temp'), 'mpt_detect.ps1')
    const scriptContent = `
$results = @()
try {
  $shell = New-Object -ComObject Shell.Application
  $myComputer = $shell.NameSpace(17)
  foreach ($item in $myComputer.Items()) {
    $p = $item.Path
    $isDrive = ($p.Length -le 4 -and $p -match '^[A-Z]:')
    $isCamera = ($item.Type -match 'Camera|Portable|MTP|PTP')
    $isUsbDevice = ($p -match 'usb#')
    if (-not $isDrive -and ($isCamera -or $isUsbDevice)) {
      $results += @{ DeviceId = $p; Name = $item.Name; DeviceType = $item.Type }
    }
  }
} catch {}
if ($results.Count -eq 0) {
  Write-Output '[]'
} else {
  $results | ConvertTo-Json -Compress
}
`
    fs.writeFileSync(tmpScript, scriptContent, 'utf8')

    exec(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpScript}"`,
      { encoding: 'utf8', timeout: 15000 },
      (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve([])
          return
        }

        try {
          const parsed = JSON.parse(stdout || '[]')
          const devices = Array.isArray(parsed) ? parsed : [parsed]
          const results: DetectedCamera[] = []
          const matchedFolders = new Set<string>()

          for (const device of devices) {
            if (!device.Name) continue
            const deviceName = device.Name.toLowerCase()

            // Try to match this device to a camera config
            let matched = false
            for (const cam of settings.cameras) {
              if (matchedFolders.has(cam.folderName)) continue
              if (!cam.deviceMatch) continue

              if (deviceName.includes(cam.deviceMatch.toLowerCase())) {
                results.push({
                  config: cam,
                  type: 'mtp' as ConnectionType,
                  sourcePath: device.DeviceId,
                  fileCount: -1, // MTP file count determined at import time
                  connected: true
                })
                matchedFolders.add(cam.folderName)
                matched = true
                break
              }
            }

            // Show unmatched MTP devices so users can still import from them
            if (!matched) {
              results.push({
                config: { name: device.Name, folderName: device.Name.replace(/[^a-zA-Z0-9_-]/g, '_') },
                type: 'mtp' as ConnectionType,
                sourcePath: device.DeviceId,
                fileCount: -1,
                connected: true
              })
            }
          }

          resolve(results)
        } catch {
          resolve([])
        }
      }
    )
  })
}

function findJpegs(dir: string): string[] {
  const results: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...findJpegs(fullPath))
      } else if (SUPPORTED_EXTENSIONS.some(ext => entry.name.toLowerCase().endsWith(ext))) {
        results.push(fullPath)
      }
    }
  } catch {
    // Permission error or similar
  }
  return results
}

// Copy (or move) files from MTP device to a local folder using PowerShell Shell.Application
// MTP devices aren't accessible via Node fs — must use COM Shell namespace
// When deleteFromDevice is true, uses MoveHere instead of CopyHere to remove originals
function copyMtpFiles(deviceId: string, targetDir: string, win: BrowserWindow | null, deleteFromDevice: boolean = false): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const tmpScript = path.join(app.getPath('temp'), 'mtp_copy.ps1')
    const psScript = `param($DeviceId, $TargetDir)
if (-not (Test-Path $TargetDir)) { New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null }

$shell = New-Object -ComObject Shell.Application
$myComputer = $shell.NameSpace(17)
$device = $null

foreach ($item in $myComputer.Items()) {
  if ($item.Path -eq $DeviceId) {
    $device = $item.GetFolder
    break
  }
}

if (-not $device) {
  Write-Error "Device not found"
  exit 1
}

function Get-JpegsFromFolder($folder, $depth) {
  if ($depth -gt 10) { return }
  $files = @()
  try {
    foreach ($item in $folder.Items()) {
      if ($item.IsFolder) {
        $files += Get-JpegsFromFolder $item.GetFolder ($depth + 1)
      } else {
        $name = $item.Name.ToLower()
        if ($name.EndsWith('.jpg') -or $name.EndsWith('.jpeg')) {
          $files += $item
        }
      }
    }
  } catch {}
  return $files
}

$jpegs = Get-JpegsFromFolder $device 0
$targetFolder = $shell.NameSpace($TargetDir)
$copied = @()
$i = 0

foreach ($jpeg in $jpegs) {
  $i++
  $name = $jpeg.Name
  Write-Host "PROGRESS:$i/$($jpegs.Count):$name"
  $targetFolder.${deleteFromDevice ? 'MoveHere' : 'CopyHere'}($jpeg, 0x14)
  $copied += $name
}

Write-Host "DONE:$($copied.Count)"
if ($copied.Count -gt 0) { $copied | ConvertTo-Json -Compress }
`
    fs.writeFileSync(tmpScript, psScript, 'utf8')

    // Use -File with arguments to avoid all escaping issues
    const safeDeviceId = deviceId.replace(/"/g, '\\"')
    const safeTargetDir = targetDir.replace(/"/g, '\\"')
    const child = exec(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpScript}" -DeviceId "${safeDeviceId}" -TargetDir "${safeTargetDir}"`,
      { encoding: 'utf8', timeout: 300000 },
      (error, stdout, stderr) => {
        if (error && !stdout.includes('DONE:')) {
          reject(new Error(stderr || error.message))
          return
        }

        // Parse the list of copied filenames
        try {
          const lines = stdout.split('\n')
          const jsonLine = lines.filter(l => l.trim().startsWith('[')).pop() ||
                          lines.filter(l => l.trim().startsWith('"')).pop() || '[]'
          const copied = JSON.parse(jsonLine)
          resolve(Array.isArray(copied) ? copied : [copied])
        } catch {
          // Count from DONE line
          const doneMatch = stdout.match(/DONE:(\d+)/)
          const count = doneMatch ? parseInt(doneMatch[1]) : 0
          // List files from target dir as fallback
          try {
            const files = fs.readdirSync(targetDir).filter(f =>
              SUPPORTED_EXTENSIONS.some(ext => f.toLowerCase().endsWith(ext))
            )
            resolve(files)
          } catch {
            resolve([])
          }
        }
      }
    )

    // Stream progress lines to renderer
    if (child.stdout) {
      child.stdout.on('data', (data: string) => {
        const lines = data.split('\n')
        for (const line of lines) {
          const match = line.match(/^PROGRESS:(\d+)\/(\d+):(.+)/)
          if (match && win) {
            win.webContents.send('import-progress', {
              current: parseInt(match[1]),
              total: parseInt(match[2]),
              currentFile: match[3].trim()
            })
          }
        }
      })
    }
  })
}

function copyFileWithProgress(
  source: string,
  target: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(source)
    const writeStream = fs.createWriteStream(target)
    readStream.on('error', reject)
    writeStream.on('error', reject)
    writeStream.on('close', resolve)
    readStream.pipe(writeStream)
  })
}

export function registerImportHandlers(): void {
  // Store detected cameras so import-photos can reference them
  let lastDetectedCameras: DetectedCamera[] = []

  ipcMain.handle('detect-cameras', async () => {
    const massStorage = detectMassStorageCameras()
    const mtp = await detectMtpCameras()

    const settings = getSettings()
    const allDetected = [...massStorage, ...mtp]
    const manualOptions: DetectedCamera[] = []

    for (const cam of settings.cameras) {
      const alreadyDetected = allDetected.some(d => d.config.folderName === cam.folderName)
      if (!alreadyDetected) {
        manualOptions.push({
          config: { ...cam },
          type: 'manual' as ConnectionType,
          sourcePath: '',
          fileCount: 0,
          connected: false
        })
      }
    }

    lastDetectedCameras = [...allDetected, ...manualOptions]
    return lastDetectedCameras
  })

  ipcMain.handle('browse-for-folder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select camera folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const dir = result.filePaths[0]
    const jpegs = findJpegs(dir)
    return { path: dir, fileCount: jpegs.length }
  })

  ipcMain.handle('import-photos', async (_event, cameraIndex: number, date: string, deleteAfterImport: boolean) => {
    const settings = getSettings()

    if (cameraIndex < 0 || cameraIndex >= lastDetectedCameras.length) {
      throw new Error('Camera not found — try refreshing cameras first')
    }

    const camera = lastDetectedCameras[cameraIndex]
    const dateFolder = date || formatDateFolder()
    const targetDir = path.join(settings.picturesRoot, camera.config.folderName, dateFolder)

    fs.mkdirSync(targetDir, { recursive: true })
    const win = BrowserWindow.getFocusedWindow()

    if (camera.type === 'mtp') {
      // MTP device: use PowerShell Shell.Application to copy/move files
      // When deleteAfterImport is true, MoveHere is used instead of CopyHere
      const copiedFiles = await copyMtpFiles(camera.sourcePath, targetDir, win, deleteAfterImport)
      return {
        imported: copiedFiles.length,
        targetPath: targetDir,
        camera: camera.config.name,
        deleted: deleteAfterImport
      }
    } else {
      // Mass storage or manual browse: source is a local filesystem path
      const sourceFiles = findJpegs(camera.sourcePath)
      const copiedSourceFiles: string[] = []

      for (let i = 0; i < sourceFiles.length; i++) {
        const sourceFile = sourceFiles[i]
        const filename = path.basename(sourceFile)
        const targetFile = path.join(targetDir, filename)

        if (win) {
          win.webContents.send('import-progress', {
            current: i + 1,
            total: sourceFiles.length,
            currentFile: filename
          })
        }

        if (!fs.existsSync(targetFile)) {
          await copyFileWithProgress(sourceFile, targetFile)
        }
        copiedSourceFiles.push(sourceFile)
      }

      // Delete source files after successful import if requested
      let deleted = false
      if (deleteAfterImport && copiedSourceFiles.length > 0) {
        for (const sourceFile of copiedSourceFiles) {
          try {
            fs.unlinkSync(sourceFile)
          } catch {
            // Skip files that can't be deleted (e.g. read-only)
          }
        }
        deleted = true
      }

      return {
        imported: sourceFiles.length,
        targetPath: targetDir,
        camera: camera.config.name,
        deleted
      }
    }
  })
}
