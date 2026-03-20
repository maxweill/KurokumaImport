const { rcedit } = require('rcedit')
const fs = require('fs')
const path = require('path')

// Find the exe in release/ directory (supports both --dir and full builds)
const candidates = [
  'release/win-unpacked/KurokumaImport.exe'
]
const exePath = candidates.find(p => fs.existsSync(path.resolve(p)))
if (!exePath) {
  console.log('No exe found to set icon on — skipping.')
  process.exit(0)
}

rcedit(exePath, {
  icon: 'build/icon.ico',
  'version-string': {
    ProductName: 'KurokumaImport',
    FileDescription: 'KurokumaImport',
    CompanyName: '',
    LegalCopyright: '',
    OriginalFilename: 'KurokumaImport.exe'
  },
  'product-version': '1.0.0',
  'file-version': '1.0.0'
}).then(() => {
  console.log('Icon and metadata set successfully!')
}).catch(e => {
  console.error('Failed:', e)
})
