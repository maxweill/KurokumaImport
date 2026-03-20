# Branding Assets

Drop your images here and reference them in `theme.json`.

## Mascot images
Place PNG files for mascot characters. Reference them in `theme.json` under `mascot`:
- `nav` — small mascot shown in the nav bar
- `importEmpty` — shown on the import screen empty state 
- `cullEmpty` — shown on the cull screen empty state
- `sessionEmpty` — shown when no sessions are available

Example in theme.json:
```json
"mascot": {
  "nav": "mascot-nav.png",
  "importEmpty": "mascot-thinking.png"
}
```

## Background images
Place background images here. Reference them in `theme.json` under `backgrounds`:
- `app` — global app background (behind everything)
- `import` — import screen background
- `cull` — cull screen background
- `settings` — settings screen background

Example:
```json
"backgrounds": {
  "app": "bg-stars.png",
  "settings": "bg-cozy.jpg"
}
```

All paths are relative to this `assets/` folder.
