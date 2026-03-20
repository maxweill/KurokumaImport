import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import defaultTheme from './theme.json'
import defaultStrings from './strings.json'

// ---- Types ----

interface ThemeColors {
  bg: string
  bgSecondary: string
  bgCard: string
  accent: string
  accentHover: string
  text: string
  textDim: string
  success: string
  warning: string
  danger: string
  border: string
}

interface ThemeFont {
  family: string
  monoFamily: string
}

interface ThemeMascots {
  nav: string | null
  importEmpty: string | null
  cullEmpty: string | null
  sessionEmpty: string | null
}

interface ThemeBackgrounds {
  app: string | null
  import: string | null
  cull: string | null
  settings: string | null
}

export interface Theme {
  colors: ThemeColors
  font: ThemeFont
  radius: string
  mascot: ThemeMascots
  backgrounds: ThemeBackgrounds
}

// Recursive string record for nested string bundles
type StringRecord = { [key: string]: string | StringRecord }

export interface Strings extends StringRecord {
  appTitle: string
  nav: { import: string; cull: string; settings: string }
  import: StringRecord
  cull: StringRecord
  session: StringRecord
  settings: StringRecord
}

export interface BrandingContextValue {
  theme: Theme
  strings: Strings
  /** Resolve an asset filename from branding/assets/ to an import-ready URL */
  asset: (filename: string | null) => string | null
  /** Template a string: replaces {key} with values from the provided object */
  t: (template: string, vars?: Record<string, string | number>) => string
}

// ---- Asset resolver ----

// Vite glob-imports all files in assets/ at build time so they get hashed URLs
const assetModules = import.meta.glob<{ default: string }>(
  './assets/**/*.{png,jpg,jpeg,gif,svg,webp}',
  { eager: true }
)

function resolveAsset(filename: string | null): string | null {
  if (!filename) return null
  // Try exact match first, then with ./assets/ prefix
  for (const [path, mod] of Object.entries(assetModules)) {
    if (path.endsWith('/' + filename) || path === './' + filename) {
      return mod.default
    }
  }
  return null
}

// ---- Template helper ----

function template(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str
  return str.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`))
}

// ---- CSS variable injection ----

const COLOR_MAP: Record<keyof ThemeColors, string> = {
  bg: '--bg',
  bgSecondary: '--bg-secondary',
  bgCard: '--bg-card',
  accent: '--accent',
  accentHover: '--accent-hover',
  text: '--text',
  textDim: '--text-dim',
  success: '--success',
  warning: '--warning',
  danger: '--danger',
  border: '--border'
}

function injectTheme(theme: Theme) {
  const root = document.documentElement
  // Colors
  for (const [key, cssVar] of Object.entries(COLOR_MAP)) {
    root.style.setProperty(cssVar, theme.colors[key as keyof ThemeColors])
  }
  // Font
  root.style.setProperty('--font-family', theme.font.family)
  root.style.setProperty('--font-mono', theme.font.monoFamily)
  // Radius
  root.style.setProperty('--radius', theme.radius)
  // Body font
  document.body.style.fontFamily = theme.font.family
}

// ---- Context ----

const BrandingContext = createContext<BrandingContextValue | null>(null)

interface Props {
  children: ReactNode
}

export function BrandingProvider({ children }: Props) {
  const [theme] = useState<Theme>(defaultTheme as Theme)
  const [strings] = useState<Strings>(defaultStrings as unknown as Strings)

  useEffect(() => {
    injectTheme(theme)
    document.title = strings.appTitle
  }, [theme, strings])

  const value: BrandingContextValue = {
    theme,
    strings,
    asset: resolveAsset,
    t: template
  }

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext)
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider')
  return ctx
}
