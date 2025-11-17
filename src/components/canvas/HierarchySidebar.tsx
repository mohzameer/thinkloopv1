import { Box, Text, Flex, Stack, Paper, Group, Loader, TextInput, ActionIcon, LoadingOverlay } from '@mantine/core'
import { IconGitBranch, IconCopy, IconGitFork, IconTrash } from '@tabler/icons-react'

interface SubItem {
  id: string
  data: {
    name: string
    isDefault: boolean
  }
}

interface MainItem {
  id: string
  data: {
    name: string
  }
  subItems: SubItem[]
}

interface HierarchySidebarProps {
  isCollapsed: boolean
  selectedFileId: string | null
  mainItems: MainItem[]
  hierarchyLoading: boolean
  selectedMainItemId: string | null
  selectedSubItemId: string | null
  editingMainItemId: string | null
  editingSubItemId: string | null
  editingName: string
  isOperationInProgress: boolean
  operationMessage: string
  onSubItemSelect: (mainItemId: string, subItemId: string) => void
  onMainItemDoubleClick: (mainItemId: string, currentName: string) => void
  onSubItemDoubleClick: (mainItemId: string, subItemId: string, currentName: string) => void
  onDuplicateSubItem: (mainItemId: string, subItemId: string) => void
  onBranchSubItem: (mainItemId: string, subItemId: string) => void
  onDeleteSubItem: (mainItemId: string, subItemId: string) => void
  onEditingNameChange: (value: string) => void
  onSaveMainItemName: (mainItemId: string) => void
  onSaveSubItemName: (mainItemId: string, subItemId: string) => void
  onCancelEdit: () => void
}

export const HierarchySidebar = ({
  isCollapsed,
  selectedFileId,
  mainItems,
  hierarchyLoading,
  selectedMainItemId,
  selectedSubItemId,
  editingMainItemId,
  editingSubItemId,
  editingName,
  isOperationInProgress,
  operationMessage,
  onSubItemSelect,
  onMainItemDoubleClick,
  onSubItemDoubleClick,
  onDuplicateSubItem,
  onBranchSubItem,
  onDeleteSubItem,
  onEditingNameChange,
  onSaveMainItemName,
  onSaveSubItemName,
  onCancelEdit
}: HierarchySidebarProps) => {
  if (isCollapsed) return null

  return (
    <>
      {/* Loading Overlay for Operations - Scoped to Sidebar */}
      <LoadingOverlay
        visible={isOperationInProgress}
        overlayProps={{ blur: 2 }}
        loaderProps={{
          children: (
            <Stack align="center" gap="md">
              <Loader size="md" />
              <Text size="xs" fw={500}>
                {operationMessage}
              </Text>
            </Stack>
          )
        }}
      />
      <Box style={{ padding: '16px', overflow: 'auto', flex: 1 }}>
        <Text size="sm" fw={600} mb="md" style={{ color: 'var(--text-secondary)', transition: 'color 0.3s ease' }}>
          Versions
        </Text>

        {!selectedFileId ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            Select a file to view hierarchy
          </Text>
        ) : hierarchyLoading ? (
          <Flex justify="center" py="xl">
            <Loader size="sm" />
          </Flex>
        ) : mainItems.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No hierarchy yet
          </Text>
        ) : (
          <Stack gap="xs">
            {mainItems.map((mainItem) => (
              <Box key={mainItem.id}>
                {/* Main Item */}
                <Paper
                  p="xs"
                  style={{
                    cursor: 'pointer',
                    border: '1px solid var(--border-color-light)',
                    transition: 'all 0.3s ease',
                    backgroundColor: 'var(--bg-primary)',
                    marginBottom: mainItem.subItems && mainItem.subItems.length > 0 ? '4px' : '0'
                  }}
                  onDoubleClick={() => onMainItemDoubleClick(mainItem.id, mainItem.data.name)}
                  onMouseEnter={(e) => {
                    if (editingMainItemId !== mainItem.id) {
                      e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
                      e.currentTarget.style.borderColor = 'var(--border-color)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (editingMainItemId !== mainItem.id) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-primary)'
                      e.currentTarget.style.borderColor = 'var(--border-color-light)'
                    }
                  }}
                >
                  <Group gap="xs" wrap="nowrap" style={{ justifyContent: 'space-between' }}>
                    <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
                      <IconGitBranch size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0, transition: 'color 0.3s ease' }} />
                      {editingMainItemId === mainItem.id && !editingSubItemId ? (
                        <TextInput
                          value={editingName}
                          onChange={(e) => onEditingNameChange(e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onSaveMainItemName(mainItem.id)
                            } else if (e.key === 'Escape') {
                              onCancelEdit()
                            }
                          }}
                          onBlur={() => onSaveMainItemName(mainItem.id)}
                          size="xs"
                          autoFocus
                          style={{ flex: 1 }}
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
                        <Text size="sm" fw={500} style={{ color: 'var(--text-primary)', transition: 'color 0.3s ease' }}>
                          {mainItem.data.name}
                        </Text>
                      )}
                    </Group>
                  </Group>
                </Paper>

                {/* Sub Items */}
                {mainItem.subItems && mainItem.subItems.length > 0 && (
                  <Stack gap="xs" style={{ marginLeft: '20px', marginBottom: '8px' }}>
                    {mainItem.subItems.map((subItem) => {
                      const isSelected = selectedMainItemId === mainItem.id && selectedSubItemId === subItem.id
                      return (
                        <Box key={subItem.id} style={{ position: 'relative' }}>
                          {/* Branch line visualization */}
                          <Box
                            style={{
                              position: 'absolute',
                              left: '-12px',
                              top: '0',
                              width: '12px',
                              height: '50%',
                              borderLeft: '2px solid var(--border-color)',
                              borderBottom: '2px solid var(--border-color)',
                              borderBottomLeftRadius: '8px',
                              transition: 'border-color 0.3s ease'
                            }}
                          />
                          <Paper
                            p="xs"
                            style={{
                              cursor: 'pointer',
                              border: '1px solid var(--border-color-light)',
                              transition: 'all 0.3s ease',
                              backgroundColor: isSelected ? '#e7f5ff' : 'var(--bg-primary)',
                              borderColor: isSelected ? '#339af0' : 'var(--border-color-light)'
                            }}
                            onClick={() => onSubItemSelect(mainItem.id, subItem.id)}
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              onSubItemDoubleClick(mainItem.id, subItem.id, subItem.data.name)
                            }}
                            onMouseEnter={(e) => {
                              const isEditing = editingMainItemId === mainItem.id && editingSubItemId === subItem.id
                              if (!isSelected && !isEditing) {
                                e.currentTarget.style.backgroundColor = 'var(--hover-bg)'
                                e.currentTarget.style.borderColor = 'var(--border-color)'
                              }
                            }}
                            onMouseLeave={(e) => {
                              const isEditing = editingMainItemId === mainItem.id && editingSubItemId === subItem.id
                              if (!isSelected && !isEditing) {
                                e.currentTarget.style.backgroundColor = 'var(--bg-primary)'
                                e.currentTarget.style.borderColor = 'var(--border-color-light)'
                              }
                            }}
                          >
                            <Group gap="xs" wrap="nowrap" style={{ justifyContent: 'space-between' }}>
                              {editingMainItemId === mainItem.id && editingSubItemId === subItem.id ? (
                                <TextInput
                                  value={editingName}
                                  onChange={(e) => onEditingNameChange(e.currentTarget.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      onSaveSubItemName(mainItem.id, subItem.id)
                                    } else if (e.key === 'Escape') {
                                      onCancelEdit()
                                    }
                                    e.stopPropagation()
                                  }}
                                  onBlur={() => onSaveSubItemName(mainItem.id, subItem.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  size="xs"
                                  autoFocus
                                  style={{ flex: 1 }}
                                  styles={{
                                    input: {
                                      fontSize: '14px',
                                      padding: '2px 6px',
                                      backgroundColor: 'var(--bg-primary)',
                                      color: 'var(--text-secondary)',
                                      borderColor: 'var(--border-color)'
                                    }
                                  }}
                                />
                              ) : (
                                <Text size="sm" c="dimmed" style={{ flex: 1 }}>
                                  {subItem.data.name}
                                  {subItem.data.isDefault && (
                                    <Text component="span" size="xs" c="blue" ml={4}>
                                      (default)
                                    </Text>
                                  )}
                                </Text>
                              )}
                              <Group gap={4} wrap="nowrap">
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  color="blue"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onDuplicateSubItem(mainItem.id, subItem.id)
                                  }}
                                  title="Duplicate variation (create copy in same branch)"
                                >
                                  <IconCopy size={14} />
                                </ActionIcon>
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  color="gray"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onBranchSubItem(mainItem.id, subItem.id)
                                  }}
                                  title="Branch off as new main branch"
                                >
                                  <IconGitFork size={14} />
                                </ActionIcon>
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  color="red"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onDeleteSubItem(mainItem.id, subItem.id)
                                  }}
                                  title="Delete variation"
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Group>
                            </Group>
                          </Paper>
                        </Box>
                      )
                    })}
                  </Stack>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </>
  )
}

