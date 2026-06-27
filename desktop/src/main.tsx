import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import { setPlatformAdapter } from '@common/adapters'
import { desktopAdapter } from './adapters'
import { initTokenCache, loadSavedApiUrl } from '@common/services/api'
import { useQualityStore } from '@common/stores/qualityStore'
import { initMediaSession } from './services/mediaSession'
import { checkForUpdate } from './services/updateService'
import './styles/index.css'

async function bootstrap() {
  setPlatformAdapter(desktopAdapter)
  await loadSavedApiUrl()
  await initTokenCache()
  await useQualityStore.getState().init()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )

  initMediaSession()

  // Check for updates after 5s (non-blocking)
  setTimeout(() => { checkForUpdate() }, 5000)
}

bootstrap()
