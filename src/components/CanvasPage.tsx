import { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Flex, Text, ActionIcon, Stack, Paper, Group, Button, Loader, TextInput } from '@mantine/core'
import { IconUser, IconChevronLeft, IconChevronRight, IconFileText, IconGitBranch, IconGitFork, IconSquare, IconCircle, IconPlus } from '@tabler/icons-react'
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Handle, Position, type Connection, type Node, type NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AuthDebugPanel } from './AuthDebugPanel'
import { useProject } from '../hooks/useProject'
import { useFiles } from '../hooks/useFiles'
import { useHierarchy } from '../hooks/useHierarchy'
import { useCanvas } from '../hooks/useCanvas'
import type { Timestamp } from 'firebase/firestore'

interface CanvasPageProps {
  userId: string
}

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

function CanvasPage({ userId }: CanvasPageProps) {
  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)
  const sidebarWidth = sidebarCollapsed ? 0 : 280
  const rightSidebarWidth = rightSidebarCollapsed ? 0 : 300

  // Selection State
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [selectedMainItemId, setSelectedMainItemId] = useState<string | null>(null)
  const [selectedSubItemId, setSelectedSubItemId] = useState<string | null>(null)

  // Firebase Hooks
  const { project, isLoading: projectLoading } = useProject(userId)
  const { files, isLoading: filesLoading, createFile } = useFiles(project?.id || null, userId)
  const { mainItems, isLoading: hierarchyLoading, branchVariation, promoteToMain } = useHierarchy(selectedFileId)
  const { 
    canvasState, 
    isLoading: canvasLoading, 
    isSaving,
    updateCanvas 
  } = useCanvas(selectedFileId, selectedMainItemId, selectedSubItemId, {
    autoSave: true,
    autoSaveDelay: 1000 // milliseconds (1 second) - adjust as needed
  })

  // React Flow State
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [nodeIdCounter, setNodeIdCounter] = useState(1)
  
  // Track if we're currently loading canvas state to prevent auto-save during load
  const isLoadingCanvas = useRef(false)
  // Track the last canvas state we loaded to prevent reloading after saves
  const lastLoadedCanvasState = useRef<string | null>(null)

  // Auto-select first file when files load (only if files exist)
  useEffect(() => {
    if (files.length > 0 && !selectedFileId) {
      setSelectedFileId(files[0].id)
    }
  }, [files, selectedFileId])

  // Auto-select first main item and default sub-item when hierarchy loads
  useEffect(() => {
    if (mainItems.length > 0 && !selectedMainItemId) {
      const firstMainItem = mainItems[0]
      setSelectedMainItemId(firstMainItem.id)
      setSelectedSubItemId(firstMainItem.data.defaultSubItemId)
    }
  }, [mainItems, selectedMainItemId])

  // Load canvas state into React Flow (only on initial load or file/item change)
  useEffect(() => {
    if (canvasState) {
      // Create a unique key for this canvas state based on file/main/sub IDs
      const canvasKey = `${selectedFileId}-${selectedMainItemId}-${selectedSubItemId}`
      
      // Only reload if this is a new canvas (different file/item) or first load
      if (lastLoadedCanvasState.current !== canvasKey) {
        console.log('[CanvasPage] Loading canvas state:', canvasState.nodes.length, 'nodes')
        isLoadingCanvas.current = true
        lastLoadedCanvasState.current = canvasKey
        
        setNodes(canvasState.nodes)
        setEdges(canvasState.edges)
        
        // Set node counter to max ID + 1
        if (canvasState.nodes.length > 0) {
          const maxId = Math.max(...canvasState.nodes.map(n => parseInt(n.id) || 0))
          setNodeIdCounter(maxId + 1)
        }
        
        // Allow saves after a short delay
        setTimeout(() => {
          isLoadingCanvas.current = false
        }, 100)
      }
    }
  }, [canvasState, selectedFileId, selectedMainItemId, selectedSubItemId, setNodes, setEdges])

  // Save canvas state on changes (debounced by useCanvas hook)
  useEffect(() => {
    // Skip if currently loading canvas state
    if (isLoadingCanvas.current) {
      return
    }

    // Skip if no file/item selected
    if (!selectedFileId || !selectedMainItemId || !selectedSubItemId) {
      return
    }

    // Skip if no nodes (empty canvas on first load)
    if (nodes.length === 0 && edges.length === 0) {
      return
    }

    console.log('[CanvasPage] Canvas changed, scheduling auto-save')
    updateCanvas({
      nodes,
      edges,
      viewport: { x: 0, y: 0, zoom: 1 }
    })
  }, [nodes, edges, selectedFileId, selectedMainItemId, selectedSubItemId, updateCanvas])

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

  const handleFileSelect = (fileId: string) => {
    setSelectedFileId(fileId)
    setSelectedMainItemId(null)
    setSelectedSubItemId(null)
  }

  const handleSubItemSelect = (mainItemId: string, subItemId: string) => {
    setSelectedMainItemId(mainItemId)
    setSelectedSubItemId(subItemId)
  }

  const handleBranchSubItem = async (mainItemId: string, subItemId: string) => {
    const count = mainItems.find(m => m.id === mainItemId)?.subItems.length || 0
    const newSubItemId = await branchVariation(mainItemId, subItemId, `Var ${count + 1}`)
    if (newSubItemId) {
      setSelectedMainItemId(mainItemId)
      setSelectedSubItemId(newSubItemId)
    }
  }

  const handlePromoteSubItem = async (mainItemId: string, subItemId: string) => {
    const subItemName = mainItems
      .find(m => m.id === mainItemId)
      ?.subItems.find(s => s.id === subItemId)?.data.name || 'Var'
    
    const result = await promoteToMain(mainItemId, subItemId, `Main-${subItemName}`)
    if (result) {
      setSelectedMainItemId(result.mainItemId)
      setSelectedSubItemId(result.subItemId)
    }
  }

  const selectedFile = files.find(f => f.id === selectedFileId)

  // Show loading state
  if (projectLoading || filesLoading) {
    return (
      <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading ThinkPost...</Text>
        </Stack>
      </Box>
    )
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
            {selectedFile?.data.name || 'No File Selected'}
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

      {/* Main content area with sidebar */}
      <Flex style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Left Sidebar - Files */}
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
              <Flex justify="space-between" align="center" mb="md">
                <Text size="sm" fw={600} style={{ color: '#666' }}>
                  Recent Files
                </Text>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => createFile('Untitled')}
                  title="New File"
                >
                  <IconPlus size={16} />
                </ActionIcon>
              </Flex>
              
              {filesLoading ? (
                <Flex justify="center" py="xl">
                  <Loader size="sm" />
                </Flex>
              ) : files.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  No files yet
                </Text>
              ) : (
                <Stack gap="xs">
                  {files.map((file) => (
                    <Paper
                      key={file.id}
                      p="sm"
                      style={{
                        cursor: 'pointer',
                        border: '1px solid #e9ecef',
                        transition: 'all 0.2s ease',
                        backgroundColor: selectedFileId === file.id ? '#f8f9fa' : 'white',
                        borderColor: selectedFileId === file.id ? '#dee2e6' : '#e9ecef'
                      }}
                      onClick={() => handleFileSelect(file.id)}
                      onMouseEnter={(e) => {
                        if (selectedFileId !== file.id) {
                          e.currentTarget.style.backgroundColor = '#f8f9fa'
                          e.currentTarget.style.borderColor = '#dee2e6'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedFileId !== file.id) {
                          e.currentTarget.style.backgroundColor = 'white'
                          e.currentTarget.style.borderColor = '#e9ecef'
                        }
                      }}
                    >
                      <Group gap="sm" wrap="nowrap">
                        <IconFileText size={20} style={{ color: '#868e96', flexShrink: 0 }} />
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Text size="sm" fw={500} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {file.data.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {formatDate(file.data.updatedAt)}
                          </Text>
                        </Box>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
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
          {!selectedFileId ? (
            // No file selected - show empty state with icon-only toolbar
            <Flex justify="center" align="center" style={{ height: '100%', flexDirection: 'column', gap: '24px' }}>
              <Stack align="center" gap="md">
                <IconFileText size={64} style={{ color: '#adb5bd' }} />
                <Text size="lg" c="dimmed">
                  Select a file to start working
                </Text>
                <Text size="sm" c="dimmed">
                  Or create a new file using the + button
                </Text>
              </Stack>

              {/* Icon-only toolbar when no file selected */}
              <Paper
                shadow="md"
                p="sm"
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  backgroundColor: 'white',
                  borderRadius: '8px'
                }}
              >
                <ActionIcon
                  size="lg"
                  variant="light"
                  color="blue"
                  disabled
                  title="Rectangle"
                >
                  <IconSquare size={20} />
                </ActionIcon>
                <ActionIcon
                  size="lg"
                  variant="light"
                  color="teal"
                  disabled
                  title="Circle"
                >
                  <IconCircle size={20} />
                </ActionIcon>
              </Paper>
            </Flex>
          ) : canvasLoading ? (
            <Flex justify="center" align="center" style={{ height: '100%' }}>
              <Stack align="center" gap="md">
                <Loader size="lg" />
                <Text c="dimmed">Loading canvas...</Text>
              </Stack>
            </Flex>
          ) : (
            <>
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

              {/* Floating Toolbar - Icon-only buttons */}
              <Paper
                shadow="md"
                p="sm"
                style={{
                  position: 'absolute',
                  top: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 5,
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  backgroundColor: 'white',
                  borderRadius: '8px'
                }}
              >
                <ActionIcon
                  size="lg"
                  variant="light"
                  color="blue"
                  onClick={() => addNode('rectangle')}
                  title="Add Rectangle"
                >
                  <IconSquare size={20} />
                </ActionIcon>
                <ActionIcon
                  size="lg"
                  variant="light"
                  color="teal"
                  onClick={() => addNode('circle')}
                  title="Add Circle"
                >
                  <IconCircle size={20} />
                </ActionIcon>
              </Paper>
            </>
          )}
        </Box>

        {/* Right Sidebar - Hierarchy */}
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
                              {mainItem.data.name}
                            </Text>
                          </Group>
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
                                  backgroundColor: 
                                    selectedMainItemId === mainItem.id && selectedSubItemId === subItem.id 
                                      ? '#e7f5ff' 
                                      : 'white',
                                  borderColor:
                                    selectedMainItemId === mainItem.id && selectedSubItemId === subItem.id
                                      ? '#339af0'
                                      : '#e9ecef'
                                }}
                                onClick={() => handleSubItemSelect(mainItem.id, subItem.id)}
                                onMouseEnter={(e) => {
                                  if (!(selectedMainItemId === mainItem.id && selectedSubItemId === subItem.id)) {
                                    e.currentTarget.style.backgroundColor = '#f8f9fa'
                                    e.currentTarget.style.borderColor = '#dee2e6'
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!(selectedMainItemId === mainItem.id && selectedSubItemId === subItem.id)) {
                                    e.currentTarget.style.backgroundColor = 'white'
                                    e.currentTarget.style.borderColor = '#e9ecef'
                                  }
                                }}
                              >
                                <Group gap="xs" wrap="nowrap" style={{ justifyContent: 'space-between' }}>
                                  <Text size="sm" c="dimmed" style={{ flex: 1 }}>
                                    {subItem.data.name}
                                    {subItem.data.isDefault && (
                                      <Text component="span" size="xs" c="blue" ml={4}>
                                        (default)
                                      </Text>
                                    )}
                                  </Text>
                                  <ActionIcon
                                    size="xs"
                                    variant="subtle"
                                    color="gray"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleBranchSubItem(mainItem.id, subItem.id)
                                    }}
                                    title="Branch variation"
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
              )}
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

      {/* Auth Debug Panel - Remove in production */}
      <AuthDebugPanel />
    </Box>
  )
}

export default CanvasPage
