import { Modal, Text, Stack, Group, Badge, Button, TextInput } from '@mantine/core'
import { useAuth } from '../hooks/useAuth'
import { signOut, upgradeAnonymousAccount } from '../firebase/auth'
import { useState } from 'react'

interface AuthModalProps {
  opened: boolean
  onClose: () => void
}

export function AuthModal({ opened, onClose }: AuthModalProps) {
  const { user, userId, isAnonymous } = useAuth()
  const [upgradeEmail, setUpgradeEmail] = useState('')
  const [upgradePassword, setUpgradePassword] = useState('')
  const [upgradeError, setUpgradeError] = useState('')
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      setUpgradeSuccess(false)
      onClose()
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
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Text fw={700}>Account</Text>
          <Badge color={isAnonymous ? 'orange' : 'green'} size="sm">
            {isAnonymous ? 'Anonymous' : 'Registered'}
          </Badge>
        </Group>
      }
      size="md"
      centered
    >
      <Stack gap="md">
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
            <Text size="sm">{user.email}</Text>
          </Stack>
        )}

        {isAnonymous && !upgradeSuccess && (
          <Stack gap="sm">
            <Text size="sm" fw={600}>
              Create Account
            </Text>
            <Text size="xs" c="dimmed">
              Upgrade your anonymous account to keep your data permanently.
            </Text>
            <TextInput
              type="email"
              placeholder="Email"
              value={upgradeEmail}
              onChange={(e) => setUpgradeEmail(e.target.value)}
              size="sm"
            />
            <TextInput
              type="password"
              placeholder="Password"
              value={upgradePassword}
              onChange={(e) => setUpgradePassword(e.target.value)}
              size="sm"
            />
            {upgradeError && (
              <Text size="xs" c="red">
                {upgradeError}
              </Text>
            )}
            <Button onClick={handleUpgrade} fullWidth>
              Create Account
            </Button>
          </Stack>
        )}

        {upgradeSuccess && (
          <Text size="sm" c="green" fw={600}>
            ✓ Account created successfully!
          </Text>
        )}

        <Button variant="light" color="gray" onClick={handleSignOut} fullWidth>
          Sign Out
        </Button>
      </Stack>
    </Modal>
  )
}

