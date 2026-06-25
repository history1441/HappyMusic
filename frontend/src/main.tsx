import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './adapters/webAdapter'  // 注入 Web 平台适配器(localStorage)
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
