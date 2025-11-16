import { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Flex, Text, ActionIcon, Stack, Paper, Group, Loader, TextInput, LoadingOverlay, Tooltip, Button, Checkbox, CloseButton } from '@mantine/core'
import { IconUser, IconChevronLeft, IconChevronRight, IconFileText, IconGitBranch, IconGitFork, IconSquare, IconCircle, IconPlus, IconTrash, IconCopy, IconHash, IconX } from '@tabler/icons-react'
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Handle, Position, type Connection, type Node, type Edge, type NodeTypes, type OnSelectionChangeParams } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AuthDebugPanel } from './AuthDebugPanel'
import { useProject } from '../hooks/useProject'
import { useFiles } from '../hooks/useFiles'
import { useHierarchy } from '../hooks/useHierarchy'
import { useCanvas } from '../hooks/useCanvas'
import type { Timestamp } from 'firebase/firestore'
import type { Tag } from '../types/firebase'

interface CanvasPageProps {
  userId: string
}

// Available colors for random assignment when creating new tags
const availableColors = [
  '#fa5252', // red
  '#82c91e', // lime
  '#e64980', // pink
  '#7950f2', // violet
  '#20c997', // green
  '#ff6b6b', // coral
  '#cc5de8', // grape
  '#51cf66', // light green
  '#ff8787', // light red
  '#339af0', // light blue
  '#ff922b', // light orange
  '#69db7c', // mint
  '#fd7e14', // orange
  '#15aabf', // cyan
  '#12b886', // teal
]

// Helper function to get color for a tag from the tags list
const getTagColor = (tagName: string, tags: Tag[]): string => {
  const tag = tags.find(t => t.name === tagName)
  return tag?.color || '#868e96' // default gray if not found
}

// Custom Circle Node Component
const CircleNode = ({ data, selected }: { data: { label: string; categories?: string[]; borderColor?: string; tags?: Tag[] }; selected?: boolean }) => {
  const tags = data.tags || []
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          border: `2px solid ${data.borderColor || '#1a192b'}`,
          backgroundColor: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 500,
          textAlign: 'center',
          padding: '8px',
          position: 'relative',
          boxShadow: selected ? '0 0 0 3px rgba(220, 38, 38, 0.3)' : 'none',
          transition: 'all 0.1s ease'
        }}
      >
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
        {data.label}
      </div>
      {data.categories && data.categories.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {data.categories.map((category, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: getTagColor(category, tags),
                color: 'white',
                padding: '1px 4px',
                borderRadius: '2px',
                fontSize: '8px',
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
const RectangleNode = ({ data, selected }: { data: { label: string; categories?: string[]; borderColor?: string; tags?: Tag[] }; selected?: boolean }) => {
  const tags = data.tags || []
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          padding: '10px 20px',
          borderRadius: '3px',
          border: `2px solid ${data.borderColor || '#1a192b'}`,
          backgroundColor: 'white',
          fontSize: '12px',
          fontWeight: 500,
          position: 'relative',
          boxShadow: selected ? '0 0 0 3px rgba(220, 38, 38, 0.3)' : 'none',
          transition: 'all 0.1s ease'
        }}
      >
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Right} />
        {data.label}
      </div>
      {data.categories && data.categories.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {data.categories.map((category, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: getTagColor(category, tags),
                color: 'white',
                padding: '1px 4px',
                borderRadius: '2px',
                fontSize: '8px',
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

// Tag Popup Component
interface TagPopupProps {
  isOpen: boolean
  onClose: () => void
  availableTags: Tag[]
  selectedTags: string[]
  onTagToggle: (tag: string) => void
  onAddTag: (tagName: string, color: string) => void
  onRemoveTag: (tagName: string) => void
}

const TagPopup = ({
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
          backgroundColor: 'white',
          borderRadius: '8px',
          maxHeight: '400px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <Flex justify="space-between" align="center" mb="sm">
          <Text size="sm" fw={600}>Select Tags</Text>
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

// Color Bar Component (needs to be inside ReactFlow context)
interface ColorBarProps {
  selectedNodes: Node[]
  colors: { name: string; value: string }[]
  updateNodeColor: (color: string) => void
  onTagClick: () => void
  isTagPopupOpen: boolean
}

const FloatingColorBar = ({ selectedNodes, colors, updateNodeColor, onTagClick, isTagPopupOpen }: ColorBarProps) => {
  if (selectedNodes.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        pointerEvents: 'auto'
      }}
    >
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
        {colors.map((color) => (
          <Tooltip key={color.value} label={color.name} position="top" withArrow>
            <ActionIcon
              size="lg"
              variant="light"
              onClick={() => updateNodeColor(color.value)}
              style={{
                backgroundColor: 'white',
                border: `2px solid ${color.value}`,
                borderRadius: '4px'
              }}
              title={color.name}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: color.value,
                  borderRadius: '2px'
                }}
              />
            </ActionIcon>
          </Tooltip>
        ))}

        {/* Divider with spacing */}
        <div style={{ width: '1px', height: '24px', backgroundColor: '#e9ecef', marginLeft: '4px' }} />

        {/* Tag button */}
        <Tooltip label="Add Tags" position="top" withArrow>
          <ActionIcon
            size="lg"
            variant="filled"
            onClick={onTagClick}
            title="Add Tags"
            style={{
              backgroundColor: isTagPopupOpen ? '#fde047' : '#fef3c7',
              color: '#92400e',
              transform: isTagPopupOpen ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.2s ease'
            }}
          >
            <IconHash size={20} />
          </ActionIcon>
        </Tooltip>
      </Paper>
    </div>
  )
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

  // Editing State
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [editingMainItemId, setEditingMainItemId] = useState<string | null>(null)
  const [editingSubItemId, setEditingSubItemId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // Operation Progress State
  const [isOperationInProgress, setIsOperationInProgress] = useState(false)
  const [operationMessage, setOperationMessage] = useState('')

  // Firebase Hooks
  const { project, isLoading: projectLoading } = useProject(userId)
  const { files, isLoading: filesLoading, createFile, renameFile, deleteFile, updateTags: updateFileTagsLocal } = useFiles(project?.id || null, userId)
  const { mainItems, isLoading: hierarchyLoading, branchVariation, promoteToMain, deleteSubItem, deleteMainItem, renameMainItem, renameSubItem } = useHierarchy(selectedFileId)
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
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [nodeIdCounter, setNodeIdCounter] = useState(1)
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([])

  // Tag System State
  const [isTagPopupOpen, setIsTagPopupOpen] = useState(false)
  const [selectedTagsForNodes, setSelectedTagsForNodes] = useState<string[]>([])

  // Get tags from selected file
  const selectedFile = files.find(f => f.id === selectedFileId)
  const fileTags = selectedFile?.data.tags || []

  // Initialize tags for files that don't have them
  useEffect(() => {
    const initializeTags = async () => {
      if (selectedFileId && selectedFile && (!selectedFile.data.tags || selectedFile.data.tags.length === 0)) {
        console.log('[CanvasPage] Initializing tags for file:', selectedFileId)
        const defaultTags: Tag[] = [
          { name: 'Idea', color: '#fab005' },      // yellow
          { name: 'New', color: '#228be6' },       // blue
          { name: 'Thinking', color: '#be4bdb' },  // purple
        ]

        try {
          await updateFileTagsLocal(selectedFileId, defaultTags)
          console.log('[CanvasPage] Tags initialized successfully')
        } catch (error) {
          console.error('[CanvasPage] Error initializing tags:', error)
        }
      }
    }

    initializeTags()
  }, [selectedFileId, selectedFile, updateFileTagsLocal])

  // Define available colors
  const colors = [
    { name: 'Black', value: '#000000' },
    { name: 'Blue', value: '#1e90ff' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Purple', value: '#a855f7' }
  ]

  // Track if we're currently loading canvas state to prevent auto-save during load
  const isLoadingCanvas = useRef(false)
  // Track the last canvas state we loaded to prevent reloading after saves
  const lastLoadedCanvasState = useRef<string | null>(null)
  // Track the current canvas key to prevent saving to wrong location
  const currentCanvasKey = useRef<string | null>(null)
  // Track previous selection to detect changes
  const previousSelectionRef = useRef<string>('')

  // Close tag popup when selection changes
  useEffect(() => {
    const currentSelection = selectedNodes.map(n => n.id).sort().join(',')
    if (previousSelectionRef.current !== currentSelection) {
      if (isTagPopupOpen) {
        setIsTagPopupOpen(false)
        setSelectedTagsForNodes([])
      }
      previousSelectionRef.current = currentSelection
    }
  }, [selectedNodes, isTagPopupOpen])

  // Auto-select first file when files load (only if files exist)
  useEffect(() => {
    if (files.length > 0 && !selectedFileId) {
      setSelectedFileId(files[0].id)
    }
  }, [files, selectedFileId])

  // Auto-select first main item and default sub-item when hierarchy loads
  useEffect(() => {
    console.log('[CanvasPage] Auto-select check:', {
      selectedFileId,
      mainItemsCount: mainItems.length,
      firstMainItemId: mainItems.length > 0 ? mainItems[0].id : null,
      selectedMainItemId,
      selectedSubItemId,
      hierarchyLoading,
      shouldAutoSelect: selectedFileId && mainItems.length > 0 && !selectedMainItemId && !hierarchyLoading
    })

    // Only auto-select if we have a file selected, hierarchy has loaded, and no main item is selected
    if (selectedFileId && mainItems.length > 0 && !selectedMainItemId && !hierarchyLoading) {
      const firstMainItem = mainItems[0]
      console.log('[CanvasPage] Auto-selecting first main item:', {
        fileId: selectedFileId,
        mainItemId: firstMainItem.id,
        subItemId: firstMainItem.data.defaultSubItemId,
        mainItemName: firstMainItem.data.name
      })
      setSelectedMainItemId(firstMainItem.id)
      setSelectedSubItemId(firstMainItem.data.defaultSubItemId)
    } else if (selectedFileId && mainItems.length > 0 && selectedMainItemId && !hierarchyLoading) {
      // Check if current selection belongs to this file's hierarchy
      const mainItemExists = mainItems.find(m => m.id === selectedMainItemId)
      if (!mainItemExists) {
        console.log('[CanvasPage] Selected main item not in current hierarchy, re-selecting first item')
        const firstMainItem = mainItems[0]
        setSelectedMainItemId(firstMainItem.id)
        setSelectedSubItemId(firstMainItem.data.defaultSubItemId)
      }
    }
  }, [mainItems, selectedMainItemId, selectedFileId, hierarchyLoading])

  // Load canvas state into React Flow (only on initial load or file/item change)
  useEffect(() => {
    if (!canvasState || !selectedFileId || !selectedMainItemId || !selectedSubItemId) {
      return
    }

    // Create a unique key for this canvas state based on file/main/sub IDs
    const expectedCanvasKey = `${selectedFileId}-${selectedMainItemId}-${selectedSubItemId}`

    // CRITICAL: Verify canvasState matches the currently selected IDs
    const canvasStateKey = (canvasState as any)._canvasKey
    if (canvasStateKey !== expectedCanvasKey) {
      console.log('[CanvasPage] Ignoring stale canvasState', {
        canvasStateKey,
        expectedCanvasKey,
        nodes: canvasState.nodes.length
      })
      return
    }

    // Only reload if this is a new canvas (different file/item) or first load
    if (lastLoadedCanvasState.current !== expectedCanvasKey) {
      console.log('[CanvasPage] Loading canvas state for key:', expectedCanvasKey, 'with', canvasState.nodes.length, 'nodes,', canvasState.edges.length, 'edges')
      isLoadingCanvas.current = true
      lastLoadedCanvasState.current = expectedCanvasKey
      currentCanvasKey.current = expectedCanvasKey

      setNodes(canvasState.nodes)
      setEdges(canvasState.edges)

      // Set node counter to max ID + 1
      if (canvasState.nodes.length > 0) {
        const maxId = Math.max(...canvasState.nodes.map(n => parseInt(n.id) || 0))
        setNodeIdCounter(maxId + 1)
      }

      // Allow saves after a longer delay to ensure state has propagated
      setTimeout(() => {
        isLoadingCanvas.current = false
        console.log('[CanvasPage] Canvas loading complete, saves now enabled for:', expectedCanvasKey)
      }, 300)
    }
  }, [canvasState, selectedFileId, selectedMainItemId, selectedSubItemId, setNodes, setEdges])

  // Save canvas state on changes (debounced by useCanvas hook)
  useEffect(() => {
    // Skip if currently loading canvas state
    if (isLoadingCanvas.current) {
      console.log('[CanvasPage] Skipping save: currently loading canvas')
      return
    }

    // Skip if no file/item selected
    if (!selectedFileId || !selectedMainItemId || !selectedSubItemId) {
      console.log('[CanvasPage] Skipping save: no file/item selected')
      return
    }

    // Verify we're saving to the correct canvas
    const expectedCanvasKey = `${selectedFileId}-${selectedMainItemId}-${selectedSubItemId}`
    if (currentCanvasKey.current !== expectedCanvasKey) {
      console.log('[CanvasPage] Skipping save: canvas key mismatch', {
        current: currentCanvasKey.current,
        expected: expectedCanvasKey
      })
      return
    }

    // Verify that the loaded canvas state matches what we're about to save
    if (lastLoadedCanvasState.current !== expectedCanvasKey) {
      console.log('[CanvasPage] Skipping save: canvas not yet loaded for this key', {
        lastLoaded: lastLoadedCanvasState.current,
        expected: expectedCanvasKey
      })
      return
    }

    // Skip if no nodes (empty canvas on first load)
    if (nodes.length === 0 && edges.length === 0) {
      console.log('[CanvasPage] Skipping save: empty canvas')
      return
    }

    console.log('[CanvasPage] Canvas changed, scheduling auto-save for:', expectedCanvasKey, 'with', nodes.length, 'nodes,', edges.length, 'edges')
    updateCanvas({
      nodes: nodes as any,
      edges: edges as any,
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

  // Handle selection changes
  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodes(params.nodes)
  }, [])

  // Update node color
  const updateNodeColor = useCallback((color: string) => {
    if (selectedNodes.length === 0) return

    setNodes((nds) =>
      nds.map((node) => {
        if (selectedNodes.some(selected => selected.id === node.id)) {
          return {
            ...node,
            data: {
              ...node.data,
              borderColor: color
            }
          }
        }
        return node
      })
    )
  }, [selectedNodes, setNodes])

  // Tag System Handlers
  const handleTagClick = useCallback(() => {
    setIsTagPopupOpen(!isTagPopupOpen)
    // When opening, load current tags from first selected node
    if (!isTagPopupOpen && selectedNodes.length > 0) {
      const firstNode = selectedNodes[0]
      const categories = (firstNode.data as any).categories || []
      setSelectedTagsForNodes(Array.isArray(categories) ? categories : [])
    }
  }, [isTagPopupOpen, selectedNodes])

  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTagsForNodes((prev) => {
      const newTags = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]

      // Apply tags to nodes in real-time
      if (selectedNodes.length > 0) {
        setNodes((nds) =>
          nds.map((node) => {
            if (selectedNodes.some(selected => selected.id === node.id)) {
              return {
                ...node,
                data: {
                  ...node.data,
                  categories: newTags,
                  tags: fileTags
                }
              }
            }
            return node
          })
        )
      }

      return newTags
    })
  }, [selectedNodes, fileTags, setNodes])

  const handleAddTag = useCallback(async (tagName: string, color: string) => {
    if (!selectedFileId) return

    const newTag: Tag = { name: tagName, color }
    const updatedTags = [...fileTags, newTag]

    try {
      await updateFileTagsLocal(selectedFileId, updatedTags)
    } catch (error) {
      console.error('[CanvasPage] Error adding tag:', error)
    }
  }, [selectedFileId, fileTags, updateFileTagsLocal])

  const handleRemoveTag = useCallback(async (tagName: string) => {
    if (!selectedFileId) return

    const updatedTags = fileTags.filter((t) => t.name !== tagName)
    setSelectedTagsForNodes((prev) => prev.filter((t) => t !== tagName))

    try {
      await updateFileTagsLocal(selectedFileId, updatedTags)
      // Also remove from all nodes
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            categories: ((node.data as any).categories || []).filter((c: string) => c !== tagName)
          }
        }))
      )
    } catch (error) {
      console.error('[CanvasPage] Error removing tag:', error)
    }
  }, [selectedFileId, fileTags, updateFileTagsLocal, setNodes])


  // Update all nodes with current file tags whenever tags or nodes change
  useEffect(() => {
    if (fileTags.length > 0) {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            tags: fileTags
          }
        }))
      )
    }
  }, [fileTags, setNodes])

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
    console.log('[CanvasPage] Selecting file:', fileId, '(clearing main/sub item selection)')
    // Immediately mark as loading to prevent saves during transition
    isLoadingCanvas.current = true
    // Clear the current canvas key to prevent saves to old location
    currentCanvasKey.current = null

    setSelectedFileId(fileId)
    setSelectedMainItemId(null)
    setSelectedSubItemId(null)
    console.log('[CanvasPage] State updates queued - main/sub items set to null')
  }

  const handleCreateFile = async () => {
    console.log('[CanvasPage] Creating new file...')

    // Immediately mark as loading to prevent saves during transition
    isLoadingCanvas.current = true
    // Clear the current canvas key to prevent saves to old location
    currentCanvasKey.current = null

    const fileId = await createFile('Untitled')
    if (fileId) {
      console.log('[CanvasPage] New file created:', fileId)
      // Select the newly created file
      setSelectedFileId(fileId)
      // Clear main/sub item selection - they will be auto-selected when hierarchy loads
      setSelectedMainItemId(null)
      setSelectedSubItemId(null)
      console.log('[CanvasPage] File selected, waiting for hierarchy to load...')
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return

    // Confirm deletion
    if (!confirm(`Delete "${file.data.name}"?\n\nThis will permanently delete the file and all its content.`)) {
      return
    }

    console.log('[CanvasPage] Deleting file:', fileId)

    // If this is the currently selected file, switch to another file first
    if (selectedFileId === fileId) {
      // Find a fallback file (prefer previous file in the list)
      const currentIndex = files.findIndex(f => f.id === fileId)
      const fallbackFile = currentIndex > 0
        ? files[currentIndex - 1]
        : files.length > 1 ? files[currentIndex + 1] : null

      if (fallbackFile) {
        console.log('[CanvasPage] Switching to fallback file:', fallbackFile.id)
        // Immediately mark as loading to prevent saves during transition
        isLoadingCanvas.current = true
        currentCanvasKey.current = null
        setSelectedFileId(fallbackFile.id)
        setSelectedMainItemId(null)
        setSelectedSubItemId(null)
      } else {
        // No other files, clear selection
        console.log('[CanvasPage] No fallback file, clearing selection')
        isLoadingCanvas.current = true
        currentCanvasKey.current = null
        setSelectedFileId(null)
        setSelectedMainItemId(null)
        setSelectedSubItemId(null)
      }
    }

    // Delete the file
    const success = await deleteFile(fileId)
    if (success) {
      console.log('[CanvasPage] File deleted successfully')
    }
  }

  const handleSubItemSelect = (mainItemId: string, subItemId: string) => {
    console.log('[CanvasPage] Selecting sub-item:', { mainItemId, subItemId })
    // Immediately mark as loading to prevent saves during transition
    isLoadingCanvas.current = true
    // Clear the current canvas key to prevent saves to old location
    currentCanvasKey.current = null
    setSelectedMainItemId(mainItemId)
    setSelectedSubItemId(subItemId)
  }

  const handleDuplicateSubItem = async (mainItemId: string, subItemId: string) => {
    console.log('[CanvasPage] Duplicating sub-item:', { mainItemId, sourceSubItemId: subItemId })

    // Show progress indicator
    setIsOperationInProgress(true)
    setOperationMessage('Duplicating variation...')

    // Immediately mark as loading to prevent saves during duplication
    isLoadingCanvas.current = true
    // Clear the current canvas key to prevent saves to old location
    currentCanvasKey.current = null

    try {
      const count = mainItems.find(m => m.id === mainItemId)?.subItems.length || 0
      const newSubItemId = await branchVariation(mainItemId, subItemId, `v${count + 1}`)
      console.log('[CanvasPage] Duplicate created, new sub-item:', newSubItemId)
      if (newSubItemId) {
        setSelectedMainItemId(mainItemId)
        setSelectedSubItemId(newSubItemId)
      }
    } finally {
      // Hide progress indicator
      setIsOperationInProgress(false)
      setOperationMessage('')
    }
  }

  const handleBranchSubItem = async (mainItemId: string, subItemId: string) => {
    console.log('[CanvasPage] Branching sub-item to new main item:', { mainItemId, subItemId })

    // Show progress indicator
    setIsOperationInProgress(true)
    setOperationMessage('Branching to new main item...')

    // Immediately mark as loading to prevent saves during branching
    isLoadingCanvas.current = true
    // Clear the current canvas key to prevent saves to old location
    currentCanvasKey.current = null

    try {
      // Get count of main items to name the new one
      const count = mainItems.length
      const newMainItemName = `Main ${count + 1}`

      const result = await promoteToMain(mainItemId, subItemId, newMainItemName)
      if (result) {
        console.log('[CanvasPage] Branch created as new main item:', result.mainItemId)
        setSelectedMainItemId(result.mainItemId)
        setSelectedSubItemId(result.subItemId)
      }
    } finally {
      // Hide progress indicator
      setIsOperationInProgress(false)
      setOperationMessage('')
    }
  }

  const handleDeleteSubItem = async (mainItemId: string, subItemId: string) => {
    const mainItem = mainItems.find(m => m.id === mainItemId)
    if (!mainItem) return

    const subItem = mainItem.subItems.find(s => s.id === subItemId)
    if (!subItem) return

    // Check if this is the last sub-item in the main item
    const isLastSubItem = mainItem.subItems.length === 1

    // If it's the last sub-item and there are multiple main items
    if (isLastSubItem && mainItems.length > 1) {
      // Confirm deletion of both sub-item and main item
      if (!confirm(`Delete "${subItem.data.name}"?\n\nThis is the last variation in this branch. The entire branch "${mainItem.data.name}" will be deleted.`)) {
        return
      }

      console.log('[CanvasPage] Deleting last sub-item, will also delete main item:', { mainItemId, subItemId })

      // Find the previous main item to fallback to
      const currentMainIndex = mainItems.findIndex(m => m.id === mainItemId)
      const fallbackMainItem = currentMainIndex > 0
        ? mainItems[currentMainIndex - 1]
        : mainItems[mainItems.length > 1 ? 1 : 0]

      // Switch to the fallback main item's first sub-item before deletion
      if (fallbackMainItem && fallbackMainItem.subItems.length > 0) {
        const fallbackSubItem = fallbackMainItem.subItems.find(s => s.data.isDefault) || fallbackMainItem.subItems[0]

        console.log('[CanvasPage] Switching to fallback:', {
          mainItemId: fallbackMainItem.id,
          subItemId: fallbackSubItem.id
        })

        // Immediately mark as loading to prevent saves during transition
        isLoadingCanvas.current = true
        currentCanvasKey.current = null
        setSelectedMainItemId(fallbackMainItem.id)
        setSelectedSubItemId(fallbackSubItem.id)
      }

      // Delete the main item (which will also delete all its sub-items)
      const success = await deleteMainItem(mainItemId)
      if (success) {
        console.log('[CanvasPage] Main item and its sub-items deleted successfully')
      }
      return
    }

    // Prevent deleting the last sub-item if it's the only main item
    if (isLastSubItem && mainItems.length === 1) {
      alert("Cannot delete the last variation in the last branch")
      return
    }

    // Confirm deletion for regular sub-item
    if (!confirm(`Delete "${subItem.data.name}"?`)) {
      return
    }

    console.log('[CanvasPage] Deleting sub-item:', { mainItemId, subItemId })

    // If currently selected, switch to another sub-item before deleting
    if (selectedMainItemId === mainItemId && selectedSubItemId === subItemId) {
      // Find another sub-item to select (prefer default, or first available)
      const otherSubItem = mainItem.subItems.find(s => s.id !== subItemId && s.data.isDefault)
        || mainItem.subItems.find(s => s.id !== subItemId)

      if (otherSubItem) {
        console.log('[CanvasPage] Switching to sub-item before deletion:', otherSubItem.id)
        // Immediately mark as loading to prevent saves during transition
        isLoadingCanvas.current = true
        currentCanvasKey.current = null
        setSelectedMainItemId(mainItemId)
        setSelectedSubItemId(otherSubItem.id)
      }
    }

    // Delete the sub-item
    const success = await deleteSubItem(mainItemId, subItemId)
    if (success) {
      console.log('[CanvasPage] Sub-item deleted successfully')
    }
  }

  // Rename handlers
  const handleFileDoubleClick = (fileId: string, currentName: string) => {
    console.log('[CanvasPage] Starting edit for file:', fileId)
    setEditingFileId(fileId)
    setEditingName(currentName)
  }

  const handleMainItemDoubleClick = (mainItemId: string, currentName: string) => {
    console.log('[CanvasPage] Starting edit for main item:', mainItemId)
    setEditingMainItemId(mainItemId)
    setEditingName(currentName)
  }

  const handleSubItemDoubleClick = (mainItemId: string, subItemId: string, currentName: string) => {
    console.log('[CanvasPage] Starting edit for sub-item:', subItemId)
    setEditingMainItemId(mainItemId)
    setEditingSubItemId(subItemId)
    setEditingName(currentName)
  }

  const handleSaveFileName = async (fileId: string) => {
    if (!editingName.trim()) {
      setEditingFileId(null)
      return
    }

    console.log('[CanvasPage] Saving file name:', editingName)
    const success = await renameFile(fileId, editingName.trim())
    if (success) {
      setEditingFileId(null)
      setEditingName('')
    }
  }

  const handleSaveMainItemName = async (mainItemId: string) => {
    if (!editingName.trim()) {
      setEditingMainItemId(null)
      return
    }

    console.log('[CanvasPage] Saving main item name:', editingName)
    const success = await renameMainItem(mainItemId, editingName.trim())
    if (success) {
      setEditingMainItemId(null)
      setEditingName('')
    }
  }

  const handleSaveSubItemName = async (mainItemId: string, subItemId: string) => {
    if (!editingName.trim()) {
      setEditingMainItemId(null)
      setEditingSubItemId(null)
      return
    }

    console.log('[CanvasPage] Saving sub-item name:', editingName)
    const success = await renameSubItem(mainItemId, subItemId, editingName.trim())
    if (success) {
      setEditingMainItemId(null)
      setEditingSubItemId(null)
      setEditingName('')
    }
  }

  const handleCancelEdit = () => {
    setEditingFileId(null)
    setEditingMainItemId(null)
    setEditingSubItemId(null)
    setEditingName('')
  }

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
                  onClick={handleCreateFile}
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
                        transition: 'all 0.1s ease',
                        backgroundColor: selectedFileId === file.id ? '#f8f9fa' : 'white',
                        borderColor: selectedFileId === file.id ? '#dee2e6' : '#e9ecef'
                      }}
                      onClick={() => handleFileSelect(file.id)}
                      onDoubleClick={() => handleFileDoubleClick(file.id, file.data.name)}
                      onMouseEnter={(e) => {
                        if (selectedFileId !== file.id && editingFileId !== file.id) {
                          e.currentTarget.style.backgroundColor = '#f8f9fa'
                          e.currentTarget.style.borderColor = '#dee2e6'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedFileId !== file.id && editingFileId !== file.id) {
                          e.currentTarget.style.backgroundColor = 'white'
                          e.currentTarget.style.borderColor = '#e9ecef'
                        }
                      }}
                    >
                      <Group gap="sm" wrap="nowrap" style={{ justifyContent: 'space-between' }}>
                        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                          <IconFileText size={20} style={{ color: '#868e96', flexShrink: 0 }} />
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            {editingFileId === file.id ? (
                              <TextInput
                                value={editingName}
                                onChange={(e) => setEditingName(e.currentTarget.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveFileName(file.id)
                                  } else if (e.key === 'Escape') {
                                    handleCancelEdit()
                                  }
                                  e.stopPropagation()
                                }}
                                onBlur={() => handleSaveFileName(file.id)}
                                onClick={(e) => e.stopPropagation()}
                                size="xs"
                                autoFocus
                                styles={{
                                  input: {
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    padding: '2px 6px'
                                  }
                                }}
                              />
                            ) : (
                              <>
                                <Text size="sm" fw={500} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                              handleDeleteFile(file.id)
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
                onSelectionChange={onSelectionChange}
                nodeTypes={nodeTypes}
                fitView
              >
                <Background />
                <Controls />
                <MiniMap />
                <TagPopup
                  isOpen={isTagPopupOpen}
                  onClose={() => {
                    setIsTagPopupOpen(false)
                    setSelectedTagsForNodes([])
                  }}
                  availableTags={fileTags}
                  selectedTags={selectedTagsForNodes}
                  onTagToggle={handleTagToggle}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                />
                <FloatingColorBar
                  selectedNodes={selectedNodes}
                  colors={colors}
                  updateNodeColor={updateNodeColor}
                  onTagClick={handleTagClick}
                  isTagPopupOpen={isTagPopupOpen}
                />
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
            flexDirection: 'column',
            position: 'relative'
          }}
        >
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
          {!rightSidebarCollapsed && (
            <Box style={{ padding: '16px', overflow: 'auto', flex: 1 }}>
              <Text size="sm" fw={600} mb="md" style={{ color: '#666' }}>
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
                          border: '1px solid #e9ecef',
                          transition: 'all 0.1s ease',
                          backgroundColor: 'white',
                          marginBottom: mainItem.subItems && mainItem.subItems.length > 0 ? '4px' : '0'
                        }}
                        onDoubleClick={() => handleMainItemDoubleClick(mainItem.id, mainItem.data.name)}
                        onMouseEnter={(e) => {
                          if (editingMainItemId !== mainItem.id) {
                            e.currentTarget.style.backgroundColor = '#f8f9fa'
                            e.currentTarget.style.borderColor = '#dee2e6'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (editingMainItemId !== mainItem.id) {
                            e.currentTarget.style.backgroundColor = 'white'
                            e.currentTarget.style.borderColor = '#e9ecef'
                          }
                        }}
                      >
                        <Group gap="xs" wrap="nowrap" style={{ justifyContent: 'space-between' }}>
                          <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
                            <IconGitBranch size={16} style={{ color: '#868e96', flexShrink: 0 }} />
                            {editingMainItemId === mainItem.id && !editingSubItemId ? (
                              <TextInput
                                value={editingName}
                                onChange={(e) => setEditingName(e.currentTarget.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveMainItemName(mainItem.id)
                                  } else if (e.key === 'Escape') {
                                    handleCancelEdit()
                                  }
                                }}
                                onBlur={() => handleSaveMainItemName(mainItem.id)}
                                size="xs"
                                autoFocus
                                style={{ flex: 1 }}
                                styles={{
                                  input: {
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    padding: '2px 6px'
                                  }
                                }}
                              />
                            ) : (
                              <Text size="sm" fw={500}>
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
                            // Debug logging - log ALL sub-items to see selection state
                            console.log('[CanvasPage] Rendering sub-item:', {
                              subItemId: subItem.id,
                              subItemName: subItem.data.name,
                              mainItemId: mainItem.id,
                              mainItemName: mainItem.data.name,
                              selectedMainItemId,
                              selectedSubItemId,
                              isSelected,
                              isDefault: subItem.data.isDefault
                            })
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
                                    transition: 'all 0.1s ease',
                                    backgroundColor: isSelected ? '#e7f5ff' : 'white',
                                    borderColor: isSelected ? '#339af0' : '#e9ecef'
                                  }}
                                  onClick={() => handleSubItemSelect(mainItem.id, subItem.id)}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation()
                                    handleSubItemDoubleClick(mainItem.id, subItem.id, subItem.data.name)
                                  }}
                                  onMouseEnter={(e) => {
                                    const isEditing = editingMainItemId === mainItem.id && editingSubItemId === subItem.id
                                    if (!isSelected && !isEditing) {
                                      e.currentTarget.style.backgroundColor = '#f8f9fa'
                                      e.currentTarget.style.borderColor = '#dee2e6'
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    const isEditing = editingMainItemId === mainItem.id && editingSubItemId === subItem.id
                                    if (!isSelected && !isEditing) {
                                      e.currentTarget.style.backgroundColor = 'white'
                                      e.currentTarget.style.borderColor = '#e9ecef'
                                    }
                                  }}
                                >
                                  <Group gap="xs" wrap="nowrap" style={{ justifyContent: 'space-between' }}>
                                    {editingMainItemId === mainItem.id && editingSubItemId === subItem.id ? (
                                      <TextInput
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.currentTarget.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleSaveSubItemName(mainItem.id, subItem.id)
                                          } else if (e.key === 'Escape') {
                                            handleCancelEdit()
                                          }
                                          e.stopPropagation()
                                        }}
                                        onBlur={() => handleSaveSubItemName(mainItem.id, subItem.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        size="xs"
                                        autoFocus
                                        style={{ flex: 1 }}
                                        styles={{
                                          input: {
                                            fontSize: '14px',
                                            padding: '2px 6px',
                                            color: '#666'
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
                                          handleDuplicateSubItem(mainItem.id, subItem.id)
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
                                          handleBranchSubItem(mainItem.id, subItem.id)
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
                                          handleDeleteSubItem(mainItem.id, subItem.id)
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
