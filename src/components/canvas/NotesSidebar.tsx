import { Box, Stack, Text, ScrollArea, Paper, Badge, Flex, ActionIcon } from '@mantine/core'
import { IconNote, IconCheck } from '@tabler/icons-react'

interface Note {
  id: string
  content: string
  createdAt: Date
  updatedAt: Date
}

interface NotesSidebarProps {
  isCollapsed: boolean
  variationId: string | null
  variationIndex?: number
  mainItemSubItems?: Array<{ id: string; data: { name: string } }>
  notes: Note[]
  isLoading?: boolean
  onDeleteNote?: (id: string) => void
  onNoteClick?: (id: string) => void
  selectedNoteId?: string | null
}

export function NotesSidebar({ isCollapsed, variationId, variationIndex, mainItemSubItems, notes, isLoading = false, onDeleteNote, onNoteClick, selectedNoteId }: NotesSidebarProps) {
  if (isCollapsed) {
    return null
  }

  // Calculate variation number (V1, V2, etc.)
  let variationLabel = 'Default'
  if (variationId && mainItemSubItems) {
    const index = mainItemSubItems.findIndex(item => item.id === variationId)
    if (index !== -1) {
      variationLabel = `V${index + 1}`
    } else if (variationIndex !== undefined) {
      variationLabel = `V${variationIndex + 1}`
    }
  } else if (variationIndex !== undefined) {
    variationLabel = `V${variationIndex + 1}`
  }

  const currentNotes = notes

  return (
    <Box
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
        borderLeft: '1px solid var(--border-color)',
        transition: 'background-color 0.3s ease, border-color 0.3s ease'
      }}
    >
      {/* Notes Header */}
      <Box
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
          transition: 'border-color 0.3s ease'
        }}
      >
        <Flex align="center" gap="sm">
          <IconNote size={20} style={{ color: 'var(--text-primary)' }} />
          <Text fw={600} size="sm" style={{ color: 'var(--text-primary)' }}>
            Notes
          </Text>
          <Badge size="sm" variant="light" color="gray">
            {currentNotes.length}
          </Badge>
        </Flex>
        <Text size="xs" c="dimmed" mt={4}>
          Variation: {variationLabel}
        </Text>
      </Box>

      {/* Notes List */}
      <ScrollArea
        style={{
          flex: 1,
          padding: '16px'
        }}
      >
        <Stack gap="md">
          {isLoading ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              Loading notes...
            </Text>
          ) : currentNotes.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No comments yet. Click the comment button and add your first note on the canvas.
            </Text>
          ) : (
            currentNotes.map((note) => (
              <Paper
                key={note.id}
                p="md"
                withBorder
                onClick={() => onNoteClick?.(note.id)}
                style={{
                  backgroundColor: 'white',
                  borderColor: selectedNoteId === note.id ? '#ef4444' : 'var(--border-color)',
                  borderWidth: selectedNoteId === note.id ? '2px' : '1px',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                {onDeleteNote && (
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="green"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteNote(note.id)
                    }}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      zIndex: 10
                    }}
                    title="Delete note"
                  >
                    <IconCheck size={16} />
                  </ActionIcon>
                )}
                <Box
                  style={{
                    paddingRight: onDeleteNote ? '32px' : '0'
                  }}
                >
                  <Text 
                    size="sm" 
                    style={{ 
                      color: 'var(--text-primary)', 
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-word',
                      fontWeight: 400
                    }}
                  >
                    {note.content}
                  </Text>
                  <Text 
                    size="xs" 
                    c="dimmed"
                    style={{ 
                      marginTop: '8px'
                    }}
                  >
                    {note.createdAt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at{' '}
                    {note.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </Box>
              </Paper>
            ))
          )}
        </Stack>
      </ScrollArea>
    </Box>
  )
}

