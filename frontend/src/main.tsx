import '@fontsource/plus-jakarta-sans/300.css'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import '@fontsource/plus-jakarta-sans/800-italic.css'
import '@fontsource/newsreader/400-italic.css'
import '@fontsource/space-grotesk/300.css'
import '@fontsource/cairo/400.css'
import '@fontsource/cairo/600.css'
import '@fontsource/cairo/700.css'
import 'leaflet/dist/leaflet.css'
import './index.css'
import './i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './app/providers'
import { router } from './app/router'
import { mocksEnabled } from './lib/env'

async function boot() {
  if (mocksEnabled) {
    try {
      const { startMocks } = await import('./mocks/browser')
      await startMocks()
    } catch (e) {
      console.error('[DriveFix] mock layer failed to start', e)
    }
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  )
}

void boot()
