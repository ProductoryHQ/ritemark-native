/**
 * Entry of `media/office-preview.js` (Sprint 124 R3). Built by
 * `vite build --mode office`; see vite.config.ts.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import '../index.css'
import { watchRitemarkThemeClass } from '../utils/themeClass'
import { OfficePreviewApp } from './OfficePreviewApp'

watchRitemarkThemeClass()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OfficePreviewApp />
  </React.StrictMode>,
)
