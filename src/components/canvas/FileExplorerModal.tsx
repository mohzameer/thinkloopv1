import { Modal, Box, Flex, Text, ActionIcon, Stack, Paper, Group, Loader, TextInput } from '@mantine/core'
import { IconPlus, IconFileText, IconTrash } from '@tabler/icons-react'
import type { Timestamp } from 'firebase/firestore'

interface FileItem {
  id: string
  data: {
    name: string
    updatedAt: Timestamp
  }
}

interface FileExplorerModalProps {
  opened: boolean
  onClose: () => void
  files: FileItem[]
  filesLoading: boolean
  selectedFileId: string | null
  editingFileId: string | null
  editingName: string
  onCreateFile: () => void
  onFileSelect: (fileId: string) => void
  onFileDoubleClick: (fileId: string, currentName: string) => void
  onDeleteFile: (fileId: string) => void
  onEditingNameChange: (value: string) => void
  onSaveFileName: (fileId: string) => void
  onCancelEdit: () => void
}

const formatDate = (timestamp: Timestamp) => {
  const date = timestamp.toDate()
  const now = new Date()
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

  if (diffInHours < 24) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } else if (diffInHours < 48) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

export const FileExplorerModal = ({
  opened,
  onClose,
  files,
  filesLoading,
  selectedFileId,
  editingFileId,
  editingName,
  onCreateFile,
  onFileSelect,
  onFileDoubleClick,
  onDeleteFile,
  onEditingNameChange,
  onSaveFileName,
  onCancelEdit
}: FileExplorerModalProps) => {
  const handleFileSelect = (fileId: string) => {
    onFileSelect(fileId)
    onClose() // Close modal when file is selected
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Flex justify="space-between" align="center" style={{ width: '100%' }}>
          <Text size="lg" fw={600} style={{ color: 'var(--text-primary)', transition: 'color 0.3s ease' }}>
            Files
          </Text>
          <ActionIcon
            size="md"
            variant="subtle"
            onClick={onCreateFile}
            title="New File"
            style={{ color: 'var(--text-primary)' }}
          >
            <IconPlus size={20} />
          </ActionIcon>
        </Flex>
      }
      size="lg"
      styles={{
        content: {
          backgroundColor: 'var(--bg-primary)',
          transition: 'background-color 0.3s ease'
        },
        header: {
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          transition: 'background-color 0.3s ease, border-color 0.3s ease'
        },
        title: {
          color: 'var(--text-primary)',
          transition: 'color 0.3s ease'
        },
        body: {
          padding: '16px'
        }
      }}
    >
      <Box style={{ maxHeight: '60vh', overflow: 'auto' }}>
        {filesLoading ? (
          <Flex justify="center" py="xl">
            <Loader size="sm" />
          </Flex>
        ) : files.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No files yet. Click the + button to create one.
          </Text>
        ) : (
          <Stack gap="xs">
            {files.map((file) => (
              <Paper
                key={file.id}
                p="sm"
                style={{
                  cursor: 'pointer',
                  border: '1px solid var(--border-color-light)',
                  transition: 'all 0.3s ease',
                  backgroundColor: selectedFileId === file.id ? 'var(--hover-bg)' : 'var(--bg-primary)',
                  borderColor: selectedFileId === file.id ? 'var(--border-color)' : 'var(--border-color-light)'
                }}
                onClick={() => handleFileSelect(file.id)}
                onDoubleClick={() => {
                  onFileDoubleClick(file.id, file.data.name)
                }}
                onMouseEnter={(e) => {
                  if (selectedFileId !== file.id && editingFileId !== file.id) {
                    e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
                    e.currentTarget.style.borderColor = 'var(--border-color)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedFileId !== file.id && editingFileId !== file.id) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-primary)'
                    e.currentTarget.style.borderColor = 'var(--border-color-light)'
                  }
                }}
              >
                <Group gap="sm" wrap="nowrap" style={{ justifyContent: 'space-between' }}>
                  <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <IconFileText size={20} style={{ color: 'var(--text-secondary)', flexShrink: 0, transition: 'color 0.3s ease' }} />
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      {editingFileId === file.id ? (
                        <TextInput
                          value={editingName}
                          onChange={(e) => onEditingNameChange(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onSaveFileName(file.id)
                            } else if (e.key === 'Escape') {
                              onCancelEdit()
                            }
                            e.stopPropagation()
                          }}
                          onBlur={() => onSaveFileName(file.id)}
                          onClick={(e) => e.stopPropagation()}
                          size="xs"
                          autoFocus
                          styles={{
                            input: {
                              fontSize: '14px',
                              fontWeight: 500,
                              padding: '2px 6px',
                              backgroundColor: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              borderColor: 'var(--border-color)'
                            }
                          }}
                        />
                      ) : (
                        <>
                          <Text size="sm" fw={500} style={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            color: 'var(--text-primary)',
                            transition: 'color 0.3s ease'
                          }}>
                            {file.data.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {formatDate(file.data.updatedAt)}
                          </Text>
                        </>
                      )}
                    </Box>
                  </Group>
                  {editingFileId !== file.id && (
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteFile(file.id)
                      }}
                      title="Delete file"
                      style={{ flexShrink: 0 }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  )}
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Box>
    </Modal>
  )
}








