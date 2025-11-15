import './App.css'
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
          backgroundColor: '#f5f5f5'
        }}
      >
        <Stack align="center" gap="lg">
          <Loader size="lg" color="blue" />
          <Text size="lg" c="dimmed">
            Initializing ThinkPost...
          </Text>
        </Stack>
      </Box>
    )
  }

  // Once authenticated (anonymous or registered), show the main app
  if (userId) {
    return <CanvasPage userId={userId} />
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
        backgroundColor: '#f5f5f5'
      }}
    >
      <Text size="lg" c="dimmed">
        Please wait...
      </Text>
    </Box>
  )
}

export default App
