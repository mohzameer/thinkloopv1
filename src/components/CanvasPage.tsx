import { useState } from 'react'
import { Box, Flex, Text, ActionIcon, Stack, Paper, Group } from '@mantine/core'
import { IconUser, IconChevronLeft, IconChevronRight, IconFileText, IconGitBranch, IconGitFork } from '@tabler/icons-react'

interface FileItem {
  id: string
  name: string
  lastUpdated: Date
}

interface HierarchySubItem {
  id: string
  name: string
  type: 'sub'
}

interface HierarchyMainItem {
  id: string
  name: string
  type: 'main'
  subItems?: HierarchySubItem[]
}

// Mock file data
const mockFiles: FileItem[] = [
  { id: '1', name: 'My First Post', lastUpdated: new Date('2025-11-15T10:30:00') },
  { id: '2', name: 'Project Ideas', lastUpdated: new Date('2025-11-14T16:45:00') },
  { id: '3', name: 'Meeting Notes', lastUpdated: new Date('2025-11-13T09:15:00') },
  { id: '4', name: 'Design Concepts', lastUpdated: new Date('2025-11-12T14:20:00') },
  { id: '5', name: 'Weekly Summary', lastUpdated: new Date('2025-11-10T11:00:00') }
]

// Mock hierarchy data
const mockHierarchy: HierarchyMainItem[] = [
  {
    id: 'main-1',
    name: 'Main',
    type: 'main',
    subItems: [
      { id: 'var-1', name: 'Var 1', type: 'sub' },
      { id: 'var-2', name: 'Var 2', type: 'sub' }
    ]
  },
  {
    id: 'main-2',
    name: 'Main 2',
    type: 'main',
    subItems: [
      { id: 'var-3', name: 'Option A', type: 'sub' },
      { id: 'var-4', name: 'Option B', type: 'sub' }
    ]
  },
  {
    id: 'main-var1',
    name: 'Main-Var1',
    type: 'main',
    subItems: []
  }
]

function CanvasPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)
  const sidebarWidth = sidebarCollapsed ? 0 : 280
  const rightSidebarWidth = rightSidebarCollapsed ? 0 : 300

  const formatDate = (date: Date) => {
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

  return (
    <Box
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
        margin: 0,
        padding: 0,
        position: 'fixed',
        top: 0,
        left: 0
      }}
    >
      {/* Header Bar */}
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
        <Text
          size="lg"
          fw={500}
          style={{
            flex: '1 1 auto',
            textAlign: 'center',
            color: '#666',
            fontSize: '16px'
          }}
        >
          Untitled Post
        </Text>

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

      {/* Main content area with sidebar */}
      <Flex style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar */}
        <Box
          style={{
            width: sidebarWidth,
            backgroundColor: 'white',
            borderRight: sidebarCollapsed ? 'none' : '1px solid #e0e0e0',
            transition: 'width 0.3s ease',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {!sidebarCollapsed && (
            <Box style={{ padding: '16px', overflow: 'auto', flex: 1 }}>
              <Text size="sm" fw={600} mb="md" style={{ color: '#666' }}>
                Recent Files
              </Text>
              <Stack gap="xs">
                {mockFiles.map((file) => (
                  <Paper
                    key={file.id}
                    p="sm"
                    style={{
                      cursor: 'pointer',
                      border: '1px solid #e9ecef',
                      transition: 'all 0.2s ease',
                      backgroundColor: 'white'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa'
                      e.currentTarget.style.borderColor = '#dee2e6'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white'
                      e.currentTarget.style.borderColor = '#e9ecef'
                    }}
                  >
                    <Group gap="sm" wrap="nowrap">
                      <IconFileText size={20} style={{ color: '#868e96', flexShrink: 0 }} />
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={500} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatDate(file.lastUpdated)}
                        </Text>
                      </Box>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}
        </Box>

        {/* Sidebar toggle button */}
        <ActionIcon
          size="md"
          variant="subtle"
          color="gray"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            position: 'absolute',
            left: sidebarCollapsed ? '8px' : `${sidebarWidth - 12}px`,
            top: '16px',
            transition: 'left 0.3s ease',
            zIndex: 5,
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '4px'
          }}
        >
          {sidebarCollapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
        </ActionIcon>

        {/* Canvas content */}
        <Box
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'margin-left 0.3s ease'
          }}
        >
          <canvas
            style={{
              border: '1px solid #ddd',
              backgroundColor: 'white'
            }}
            width={800}
            height={600}
          />
        </Box>

        {/* Right Sidebar */}
        <Box
          style={{
            width: rightSidebarWidth,
            backgroundColor: 'white',
            borderLeft: rightSidebarCollapsed ? 'none' : '1px solid #e0e0e0',
            transition: 'width 0.3s ease',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {!rightSidebarCollapsed && (
            <Box style={{ padding: '16px', overflow: 'auto', flex: 1 }}>
              <Text size="sm" fw={600} mb="md" style={{ color: '#666' }}>
                Hierarchy
              </Text>
              <Stack gap="xs">
                {mockHierarchy.map((mainItem) => (
                  <Box key={mainItem.id}>
                    {/* Main Item */}
                    <Paper
                      p="xs"
                      style={{
                        cursor: 'pointer',
                        border: '1px solid #e9ecef',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'white',
                        marginBottom: mainItem.subItems && mainItem.subItems.length > 0 ? '4px' : '0'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8f9fa'
                        e.currentTarget.style.borderColor = '#dee2e6'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white'
                        e.currentTarget.style.borderColor = '#e9ecef'
                      }}
                    >
                      <Group gap="xs" wrap="nowrap" style={{ justifyContent: 'space-between' }}>
                        <Group gap="xs" wrap="nowrap">
                          <IconGitBranch size={16} style={{ color: '#868e96', flexShrink: 0 }} />
                          <Text size="sm" fw={500}>
                            {mainItem.name}
                          </Text>
                        </Group>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="gray"
                          onClick={(e) => {
                            e.stopPropagation()
                            console.log('Branch from:', mainItem.name)
                          }}
                        >
                          <IconGitFork size={14} />
                        </ActionIcon>
                      </Group>
                    </Paper>

                    {/* Sub Items */}
                    {mainItem.subItems && mainItem.subItems.length > 0 && (
                      <Stack gap="xs" style={{ marginLeft: '20px', marginBottom: '8px' }}>
                        {mainItem.subItems.map((subItem) => (
                          <Box key={subItem.id} style={{ position: 'relative' }}>
                            {/* Branch line visualization */}
                            <Box
                              style={{
                                position: 'absolute',
                                left: '-12px',
                                top: '0',
                                width: '12px',
                                height: '50%',
                                borderLeft: '2px solid #dee2e6',
                                borderBottom: '2px solid #dee2e6',
                                borderBottomLeftRadius: '8px'
                              }}
                            />
                            <Paper
                              p="xs"
                              style={{
                                cursor: 'pointer',
                                border: '1px solid #e9ecef',
                                transition: 'all 0.2s ease',
                                backgroundColor: 'white'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8f9fa'
                                e.currentTarget.style.borderColor = '#dee2e6'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'white'
                                e.currentTarget.style.borderColor = '#e9ecef'
                              }}
                            >
                              <Group gap="xs" wrap="nowrap" style={{ justifyContent: 'space-between' }}>
                                <Text size="sm" c="dimmed" style={{ flex: 1 }}>
                                  {subItem.name}
                                </Text>
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  color="gray"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    console.log('Branch from:', subItem.name)
                                  }}
                                >
                                  <IconGitFork size={14} />
                                </ActionIcon>
                              </Group>
                            </Paper>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Box>

        {/* Right Sidebar toggle button */}
        <ActionIcon
          size="md"
          variant="subtle"
          color="gray"
          onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
          style={{
            position: 'absolute',
            right: rightSidebarCollapsed ? '8px' : `${rightSidebarWidth - 12}px`,
            top: '16px',
            transition: 'right 0.3s ease',
            zIndex: 5,
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '4px'
          }}
        >
          {rightSidebarCollapsed ? <IconChevronLeft size={18} /> : <IconChevronRight size={18} />}
        </ActionIcon>
      </Flex>
    </Box>
  )
}

export default CanvasPage

