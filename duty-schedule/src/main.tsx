import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import FlexibleDemo from './FlexibleDemo.tsx'
import './index.css'

const path = window.location.pathname;
const AppComponent = path === '/demo' ? FlexibleDemo : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppComponent />
  </StrictMode>,
)
