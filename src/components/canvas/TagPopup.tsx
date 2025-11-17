import { useState } from 'react'
import { Paper, Flex, Text, CloseButton, Stack, Checkbox, ActionIcon, TextInput, Button } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import type { Tag } from '../../types/firebase'
import { availableColors } from './utils'

interface TagPopupProps {
  isOpen: boolean
  onClose: () => void
  availableTags: Tag[]
  selectedTags: string[]
  onTagToggle: (tag: string) => void
  onAddTag: (tagName: string, color: string) => void
  onRemoveTag: (tagName: string) => void
}

export const TagPopup = ({
  isOpen,
  onClose,
  availableTags,
  selectedTags,
  onTagToggle,
  onAddTag,
  onRemoveTag
}: TagPopupProps) => {
  const [newTagInput, setNewTagInput] = useState('')

  if (!isOpen) return null

  const handleAddTag = () => {
    const tagName = newTagInput.trim()
    if (tagName && !availableTags.some(t => t.name === tagName)) {
      // Pick a random color for the new tag
      const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)]
      onAddTag(tagName, randomColor)
      setNewTagInput('')
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1001,
        pointerEvents: 'auto'
      }}
    >
      <Paper
        shadow="lg"
        p="md"
        style={{
          width: '280px',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '8px',
          maxHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          transition: 'background-color 0.3s ease'
        }}
      >
        {/* Header */}
        <Flex justify="space-between" align="center" mb="sm">
          <Text size="sm" fw={600} style={{ color: 'var(--text-primary)', transition: 'color 0.3s ease' }}>Select Tags</Text>
          <CloseButton size="sm" onClick={onClose} />
        </Flex>

        {/* Tag List with checkboxes */}
        <Stack gap="xs" style={{ flex: 1, overflowY: 'auto', marginBottom: '12px' }}>
          {availableTags.map((tag) => (
            <Flex key={tag.name} align="center" justify="space-between" gap="xs">
              <Flex align="center" gap="xs" style={{ flex: 1 }}>
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    backgroundColor: tag.color,
                    flexShrink: 0
                  }}
                />
                <Checkbox
                  label={tag.name}
                  checked={selectedTags.includes(tag.name)}
                  onChange={() => onTagToggle(tag.name)}
                  size="sm"
                  styles={{
                    label: { fontSize: '13px' },
                    root: { flex: 1 }
                  }}
                />
              </Flex>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => onRemoveTag(tag.name)}
                title="Remove tag from list"
              >
                <IconX size={12} />
              </ActionIcon>
            </Flex>
          ))}
        </Stack>

        {/* Add new tag input */}
        <Flex gap="xs">
          <TextInput
            placeholder="New tag..."
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddTag()
              }
            }}
            size="xs"
            style={{ flex: 1 }}
          />
          <Button size="xs" onClick={handleAddTag}>
            Add
          </Button>
        </Flex>
      </Paper>
    </div>
  )
}

