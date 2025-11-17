import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import './index.css'
import '@mantine/core/styles.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'

const mantineTheme = createTheme({
  /** Your theme config here */
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <MantineProvider theme={mantineTheme}>
        <App />
      </MantineProvider>
    </ThemeProvider>
  </StrictMode>,
)
