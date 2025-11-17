import { Flex, Text, ActionIcon, Loader, Group } from '@mantine/core'
import { IconUser, IconMoon, IconSun } from '@tabler/icons-react'
import { useTheme } from '../../contexts/ThemeContext'

interface FileItem {
  id: string
  data: {
    name: string
  }
}

interface HeaderProps {
  selectedFile: FileItem | undefined
  isSaving: boolean
}

export const Header = ({ selectedFile, isSaving }: HeaderProps) => {
  const { theme, toggleTheme } = useTheme()

  return (
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
      {/* Left: App Name */}
      <Text
        size="xl"
        fw={700}
        style={{
          flex: '0 0 auto',
          fontSize: '20px',
          color: 'var(--text-primary)',
          transition: 'color 0.3s ease'
        }}
      >
        ThinkPost
      </Text>

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

      {/* Right: Theme Toggle & User Button */}
      <Group gap="xs" style={{ flex: '0 0 auto' }}>
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
        >
          <IconUser size={24} />
        </ActionIcon>
      </Group>
    </Flex>
  )
}

