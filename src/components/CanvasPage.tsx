import { useState, useCallback } from 'react'
import { Box, Flex, Text, ActionIcon, Stack, Paper, Group, Button } from '@mantine/core'
import { IconUser, IconChevronLeft, IconChevronRight, IconFileText, IconGitBranch, IconGitFork, IconSquare, IconCircle } from '@tabler/icons-react'
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Handle, Position, type Connection, type Node, type NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

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

// Custom Circle Node Component
const CircleNode = ({ data }: { data: { label: string; categories?: string[] } }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          border: '2px solid #1a192b',
          backgroundColor: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 500,
          textAlign: 'center',
          padding: '8px',
          position: 'relative'
        }}
      >
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
        {data.label}
      </div>
      {data.categories && data.categories.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {data.categories.map((category, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: '#228be6',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '9px',
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}
            >
              {category}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Custom Rectangle Node Component
const RectangleNode = ({ data }: { data: { label: string; categories?: string[] } }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          padding: '10px 20px',
          borderRadius: '3px',
          border: '1px solid #1a192b',
          backgroundColor: 'white',
          fontSize: '12px',
          fontWeight: 500,
          position: 'relative'
        }}
      >
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
        {data.label}
      </div>
      {data.categories && data.categories.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {data.categories.map((category, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: '#12b886',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '9px',
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}
            >
              {category}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Define node types
const nodeTypes: NodeTypes = {
  circle: CircleNode,
  rectangle: RectangleNode
}

// Initial nodes for React Flow
const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Start' },
    position: { x: 250, y: 25 }
  },
  {
    id: '2',
    type: 'rectangle',
    data: { 
      label: 'Rectangle Node',
      categories: ['Design', 'Important']
    },
    position: { x: 100, y: 150 }
  },
  {
    id: '3',
    type: 'circle',
    data: { 
      label: 'Circle Node',
      categories: ['Development']
    },
    position: { x: 400, y: 150 }
  },
  {
    id: '4',
    type: 'output',
    data: { label: 'End' },
    position: { x: 250, y: 300 }
  }
]

// Initial edges for React Flow
const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e1-3', source: '1', target: '3' },
  { id: 'e2-4', source: '2', target: '4' },
  { id: 'e3-4', source: '3', target: '4' }
]

function CanvasPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)
  const sidebarWidth = sidebarCollapsed ? 0 : 280
  const rightSidebarWidth = rightSidebarCollapsed ? 0 : 300
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [nodeIdCounter, setNodeIdCounter] = useState(5)
  
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const addNode = useCallback((nodeType: 'rectangle' | 'circle') => {
    const newNode: Node = {
      id: `${nodeIdCounter}`,
      type: nodeType,
      data: { label: `${nodeType === 'circle' ? 'Circle' : 'Rectangle'} ${nodeIdCounter}` },
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100
      }
    }
    setNodes((nds) => [...nds, newNode])
    setNodeIdCounter((id) => id + 1)
  }, [nodeIdCounter, setNodes])

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

        {/* React Flow Canvas */}
        <Box
          style={{
            flex: 1,
            transition: 'margin-left 0.3s ease',
            position: 'relative'
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>

          {/* Floating Toolbar */}
          <Paper
            shadow="md"
            p="md"
            style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 5,
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              backgroundColor: 'white',
              borderRadius: '8px'
            }}
          >
            <Text size="sm" fw={600} style={{ color: '#666' }}>
              Add Node:
            </Text>
            <Button
              leftSection={<IconSquare size={18} />}
              variant="light"
              color="blue"
              size="sm"
              onClick={() => addNode('rectangle')}
            >
              Rectangle
            </Button>
            <Button
              leftSection={<IconCircle size={18} />}
              variant="light"
              color="teal"
              size="sm"
              onClick={() => addNode('circle')}
            >
              Circle
            </Button>
          </Paper>
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

