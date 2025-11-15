import { Container, Title, Text, Button, Paper, Group, Stack, Box } from '@mantine/core'
import './App.css'

function App() {
  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <Container size="md">
        <Paper
          shadow="xl"
          radius="lg"
          p="xl"
          style={{
            backdropFilter: 'blur(10px)',
            backgroundColor: 'rgba(255, 255, 255, 0.95)'
          }}
        >
          <Stack gap="lg" align="center">
            <Title
              order={1}
              size="3.5rem"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 900,
                textAlign: 'center'
              }}
            >
              Hello World
            </Title>

            <Text
              size="xl"
              c="dimmed"
              ta="center"
              style={{ maxWidth: '600px' }}
            >
              Welcome to your new React + Vite application powered by Mantine UI
            </Text>

            <Group gap="md" mt="xl">
              <Button
                size="lg"
                variant="gradient"
                gradient={{ from: 'grape', to: 'violet', deg: 135 }}
                radius="md"
              >
                Get Started
              </Button>
              <Button
                size="lg"
                variant="outline"
                color="violet"
                radius="md"
              >
                Learn More
              </Button>
            </Group>

            <Text size="sm" c="dimmed" mt="xl" ta="center">
              Built with ❤️ using Mantine Components
            </Text>
          </Stack>
        </Paper>
      </Container>
    </Box>
  )
}

export default App
