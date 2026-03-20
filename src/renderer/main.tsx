import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrandingProvider } from './branding/BrandingProvider'
import App from './App'
import './styles.css'

const root = createRoot(document.getElementById('root')!)
root.render(
  <BrandingProvider>
    <App />
  </BrandingProvider>
)
