import { Paper, Text, Stack, Group, Badge, Button } from '@mantine/core'
import { useAuth } from '../hooks/useAuth'
import { signOut, upgradeAnonymousAccount } from '../firebase/auth'
import { useState } from 'react'

/**
 * Debug panel to show authentication status
 * Remove this component in production
 */
export function AuthDebugPanel() {
  const { user, userId, isAnonymous } = useAuth()
  const [upgradeEmail, setUpgradeEmail] = useState('')
  const [upgradePassword, setUpgradePassword] = useState('')
  const [upgradeError, setUpgradeError] = useState('')
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      setUpgradeSuccess(false)
    } catch (error) {
      console.error('Failed to sign out:', error)
    }
  }

  const handleUpgrade = async () => {
    if (!upgradeEmail || !upgradePassword) {
      setUpgradeError('Email and password are required')
      return
    }

    try {
      setUpgradeError('')
      await upgradeAnonymousAccount(upgradeEmail, upgradePassword)
      setUpgradeSuccess(true)
      setUpgradeEmail('')
      setUpgradePassword('')
    } catch (error: any) {
      setUpgradeError(error.message || 'Failed to upgrade account')
    }
  }

  return (
    <Paper
      shadow="md"
      p="md"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000,
        minWidth: '300px',
        maxWidth: '400px'
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" fw={700}>
            Auth Debug Panel
          </Text>
          <Badge color={isAnonymous ? 'orange' : 'green'} size="sm">
            {isAnonymous ? 'Anonymous' : 'Registered'}
          </Badge>
        </Group>

        <Stack gap="xs">
          <Text size="xs" c="dimmed">
            User ID:
          </Text>
          <Text size="xs" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {userId}
          </Text>
        </Stack>

        {user?.email && (
          <Stack gap="xs">
            <Text size="xs" c="dimmed">
              Email:
            </Text>
            <Text size="xs">{user.email}</Text>
          </Stack>
        )}

        {isAnonymous && !upgradeSuccess && (
          <Stack gap="xs">
            <Text size="xs" fw={600}>
              Upgrade to Email Account:
            </Text>
            <input
              type="email"
              placeholder="Email"
              value={upgradeEmail}
              onChange={(e) => setUpgradeEmail(e.target.value)}
              style={{
                padding: '6px 10px',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid #dee2e6'
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={upgradePassword}
              onChange={(e) => setUpgradePassword(e.target.value)}
              style={{
                padding: '6px 10px',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid #dee2e6'
              }}
            />
            {upgradeError && (
              <Text size="xs" c="red">
                {upgradeError}
              </Text>
            )}
            <Button size="xs" onClick={handleUpgrade}>
              Upgrade Account
            </Button>
          </Stack>
        )}

        {upgradeSuccess && (
          <Text size="xs" c="green" fw={600}>
            ✓ Account upgraded successfully!
          </Text>
        )}

        <Button size="xs" variant="light" color="gray" onClick={handleSignOut}>
          Sign Out
        </Button>
      </Stack>
    </Paper>
  )
}

