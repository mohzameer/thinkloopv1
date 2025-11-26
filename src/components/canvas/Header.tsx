import { Flex, Text, ActionIcon, Loader, Group, Button } from '@mantine/core'
import { IconUser, IconMoon, IconSun, IconFolder, IconPlus, IconDownload } from '@tabler/icons-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useState } from 'react'
import { AuthModal } from '../AuthModal'

interface FileItem {
  id: string
  data: {
    name: string
  }
}

interface HeaderProps {
  selectedFile: FileItem | undefined
  isSaving: boolean
  onOpenFileExplorer: () => void
}

export const Header = ({ selectedFile, isSaving, onOpenFileExplorer }: HeaderProps) => {
  const { theme, toggleTheme } = useTheme()
  const [authModalOpened, setAuthModalOpened] = useState(false)

  return (
    <>
    <Flex
      style={{
        height: '60px',
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 24px',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
        transition: 'background-color 0.3s ease, border-color 0.3s ease'
      }}
    >
      {/* Left: App Name and New Idea Button */}
      <Group gap="md" style={{ flex: '0 0 auto' }}>
        <Text
          size="xl"
          fw={700}
          style={{
            fontSize: '20px',
            color: 'var(--text-primary)',
            transition: 'color 0.3s ease'
          }}
        >
          ThinkLoops
        </Text>
        <Button
          variant="subtle"
          leftSection={<IconPlus size={18} />}
          size="sm"
          style={{
            color: 'var(--text-primary)',
            transition: 'color 0.3s ease'
          }}
        >
          New Idea
        </Button>
      </Group>

      {/* Middle: Post Title */}
      <Flex align="center" gap="sm" style={{ flex: '1 1 auto', justifyContent: 'center' }}>
        <Text
          size="lg"
          fw={500}
          style={{
            textAlign: 'center',
            color: selectedFile ? 'var(--text-secondary)' : 'var(--text-tertiary)',
            fontSize: '16px',
            transition: 'color 0.3s ease'
          }}
        >
          {selectedFile?.data?.name || 'No File Selected'}
        </Text>
        {isSaving && selectedFile && (
          <Loader size="xs" />
        )}
      </Flex>

      {/* Right: All Ideas, Export, Theme Toggle & User Button */}
      <Group gap="xs" style={{ flex: '0 0 auto' }}>
        <Button
          variant="subtle"
          leftSection={<IconFolder size={18} />}
          size="sm"
          onClick={onOpenFileExplorer}
          style={{
            color: 'var(--text-primary)',
            transition: 'color 0.3s ease'
          }}
        >
          All Ideas
        </Button>
        <Button
          variant="subtle"
          leftSection={<IconDownload size={18} />}
          size="sm"
          style={{
            color: 'var(--text-primary)',
            transition: 'color 0.3s ease'
          }}
        >
          Export
        </Button>
        <ActionIcon
          size="lg"
          variant="subtle"
          color="gray"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <IconSun size={24} /> : <IconMoon size={24} />}
        </ActionIcon>
        <ActionIcon
          size="lg"
          variant="subtle"
          color="gray"
          onClick={() => setAuthModalOpened(true)}
          title="Account"
        >
          <IconUser size={24} />
        </ActionIcon>
      </Group>
    </Flex>

    <AuthModal
      opened={authModalOpened}
      onClose={() => setAuthModalOpened(false)}
    />
    </>
  )
}

