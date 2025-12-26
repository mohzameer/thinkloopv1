import { Paper, Textarea, ActionIcon, Box, Flex } from '@mantine/core'
import { IconX, IconCheck, IconTrash } from '@tabler/icons-react'
import { useState, useEffect, useRef } from 'react'

interface NotePopupProps {
  x: number
  y: number
  content: string
  onClose: () => void
  onSave?: (content: string) => void
  onDelete?: () => void
}

export function NotePopup({ x, y, content, onClose, onSave, onDelete }: NotePopupProps) {
  const [editedContent, setEditedContent] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Update content when prop changes (for background loading)
  useEffect(() => {
    setEditedContent(content)
  }, [content])

  useEffect(() => {
    // Focus textarea immediately when popup opens
    // Use setTimeout with 0 delay to ensure DOM is ready but don't wait for next frame
    const timeoutId = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(editedContent.length, editedContent.length)
      }
    }, 0)
    
    return () => clearTimeout(timeoutId)
  }, [])

  const handleSave = () => {
    if (onSave) {
      onSave(editedContent)
    }
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave()
    }
  }

  return (
    <Box
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        minWidth: '300px',
        maxWidth: '400px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Paper
        shadow="xl"
        p="md"
        withBorder
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-color)',
          transition: 'background-color 0.3s ease, border-color 0.3s ease'
        }}
      >
        <Flex direction="column" gap="sm">
          <Textarea
            ref={textareaRef}
            value={editedContent}
            onChange={(e) => setEditedContent(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add your note..."
            autosize
            minRows={3}
            maxRows={8}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              transition: 'background-color 0.3s ease'
            }}
          />
          <Flex justify="flex-end" gap="xs">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onClose}
              title="Close"
            >
              <IconX size={18} />
            </ActionIcon>
            {onDelete && (
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => {
                  onDelete()
                  onClose()
                }}
                title="Delete note"
              >
                <IconTrash size={18} />
              </ActionIcon>
            )}
            <ActionIcon
              variant="filled"
              color="blue"
              onClick={handleSave}
              title="Save note (Cmd/Ctrl + Enter)"
            >
              <IconCheck size={18} />
            </ActionIcon>
          </Flex>
        </Flex>
      </Paper>
    </Box>
  )
}

