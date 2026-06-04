import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startMetricsScheduler } from './services/aggregator'

// Start the egress query metrics aggregator scheduler
startMetricsScheduler();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
