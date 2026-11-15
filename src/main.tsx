import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { applyAppearance, loadPrefsFromDb } from './lib/prefs'

applyAppearance()
void loadPrefsFromDb()

// Просим браузер не удалять наши данные при нехватке места.
void navigator.storage?.persist?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
