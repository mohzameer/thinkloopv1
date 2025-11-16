import { Flex, Text, ActionIcon, Loader } from '@mantine/core'
import { IconUser } from '@tabler/icons-react'

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
  return (
    <Flex
      style={{
        height: '60px',
        backgroundColor: 'white',
        borderBottom: '1px solid #e0e0e0',
        padding: '0 24px',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10
      }}
    >
      {/* Left: App Name */}
      <Text
        size="xl"
        fw={700}
        style={{
          flex: '0 0 auto',
          fontSize: '20px',
          color: '#1a1a1a'
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
            color: selectedFile ? '#666' : '#adb5bd',
            fontSize: '16px'
          }}
        >
          {selectedFile?.data?.name || 'No File Selected'}
        </Text>
        {isSaving && selectedFile && (
          <Loader size="xs" />
        )}
      </Flex>

      {/* Right: User Button */}
      <ActionIcon
        size="lg"
        variant="subtle"
        color="gray"
        style={{
          flex: '0 0 auto'
        }}
      >
        <IconUser size={24} />
      </ActionIcon>
    </Flex>
  )
}

