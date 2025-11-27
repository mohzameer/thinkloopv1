import './App.css'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import CanvasPage from './components/CanvasPage'
import { Box, Loader, Text, Stack } from '@mantine/core'

function App() {
  const { userId, isLoading, isInitialized } = useAuth()

  // Show loading screen while authentication is initializing
  if (isLoading || !isInitialized) {
    return (
      <Box
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          width: '100vw',
          backgroundColor: 'var(--bg-secondary)',
          transition: 'background-color 0.3s ease'
        }}
      >
        <Stack align="center" gap="lg">
          <Loader size="lg" color="blue" />
          <Text size="lg" c="dimmed">
            Initializing ThinkLoops...
          </Text>
        </Stack>
      </Box>
    )
  }

  // Once authenticated (anonymous or registered), show the main app
  if (userId) {
    return (
      <Routes>
        <Route path="/" element={<CanvasPage userId={userId} />} />
        <Route path="/:fileId" element={<CanvasPage userId={userId} />} />
      </Routes>
    )
  }

  // Fallback (should rarely reach here)
  return (
    <Box
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--bg-secondary)',
        transition: 'background-color 0.3s ease'
      }}
    >
      <Text size="lg" c="dimmed">
        Please wait...
      </Text>
    </Box>
  )
}

export default App
