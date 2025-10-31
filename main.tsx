import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import FlamingUnicornRunner from './flappy-fire.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FlamingUnicornRunner />
  </StrictMode>,
)
