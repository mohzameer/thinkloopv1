import { useState, useCallback, useEffect, useRef } from 'react'
import { Box, Flex, ActionIcon, Stack, Loader, Text } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { addEdge, useNodesState, useEdgesState, type Connection, type Node, type Edge, type OnSelectionChangeParams } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AuthDebugPanel } from './AuthDebugPanel'
import { useProject } from '../hooks/useProject'
import { useFiles } from '../hooks/useFiles'
import { useHierarchy } from '../hooks/useHierarchy'
import { useCanvas } from '../hooks/useCanvas'
import type { Tag } from '../types/firebase'
import { Header } from './canvas/Header'
import { FilesSidebar } from './canvas/FilesSidebar'
import { HierarchySidebar } from './canvas/HierarchySidebar'
import { CanvasArea } from './canvas/CanvasArea'

interface CanvasPageProps {
  userId: string
}

function CanvasPage({ userId }: CanvasPageProps) {
  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
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

  // Node Editing State
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  // Edge Editing State
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null)

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


  // Node editing handlers
  const handleNodeLabelChange = useCallback((nodeId: string, newLabel: string) => {
    // Update the node in real-time
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              label: newLabel
            }
          }
        }
        return node
      })
    )
  }, [setNodes])

  const handleNodeEditingComplete = useCallback(() => {
    setEditingNodeId(null)
  }, [])

  // Edge editing handlers
  const handleEdgeLabelChange = useCallback((edgeId: string, newLabel: string) => {
    // Update the edge in real-time
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === edgeId) {
          return {
            ...edge,
            data: {
              ...edge.data,
              label: newLabel
            }
          }
        }
        return edge
      })
    )
  }, [setEdges])

  const handleEdgeEditingComplete = useCallback(() => {
    setEditingEdgeId(null)
  }, [])

  // Update all nodes with current file tags whenever tags change
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
  }, [fileTags])

  // Update nodes with editing state and handlers
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isEditing: editingNodeId === node.id,
          onLabelChange: (value: string) => handleNodeLabelChange(node.id, value),
          onEditingComplete: handleNodeEditingComplete
        }
      }))
    )
  }, [editingNodeId, handleNodeLabelChange, handleNodeEditingComplete])

  // Update edges with editing state and handlers
  useEffect(() => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          isEditing: editingEdgeId === edge.id,
          onLabelChange: (value: string) => handleEdgeLabelChange(edge.id, value),
          onEditingComplete: handleEdgeEditingComplete
        }
      }))
    )
  }, [editingEdgeId, handleEdgeLabelChange, handleEdgeEditingComplete])


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
      <Header selectedFile={selectedFile} isSaving={isSaving} />

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
          <FilesSidebar
            isCollapsed={sidebarCollapsed}
            files={files}
            filesLoading={filesLoading}
            selectedFileId={selectedFileId}
            editingFileId={editingFileId}
            editingName={editingName}
            onCreateFile={handleCreateFile}
            onFileSelect={handleFileSelect}
            onFileDoubleClick={handleFileDoubleClick}
            onDeleteFile={handleDeleteFile}
            onEditingNameChange={setEditingName}
            onSaveFileName={handleSaveFileName}
            onCancelEdit={handleCancelEdit}
          />
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
          <CanvasArea
            selectedFileId={selectedFileId}
            canvasLoading={canvasLoading}
            nodes={nodes}
            edges={edges}
            selectedNodes={selectedNodes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            onNodeDoubleClick={(_, node) => {
              setEditingNodeId(node.id)
            }}
            onEdgeDoubleClick={(_, edge) => {
              setEditingEdgeId(edge.id)
            }}
            onAddNode={addNode}
            isTagPopupOpen={isTagPopupOpen}
            selectedTagsForNodes={selectedTagsForNodes}
            fileTags={fileTags}
            onTagClick={handleTagClick}
            onTagPopupClose={() => {
              setIsTagPopupOpen(false)
              setSelectedTagsForNodes([])
            }}
            onTagToggle={handleTagToggle}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            colors={colors}
            updateNodeColor={updateNodeColor}
          />
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
          <HierarchySidebar
            isCollapsed={rightSidebarCollapsed}
            selectedFileId={selectedFileId}
            mainItems={mainItems}
            hierarchyLoading={hierarchyLoading}
            selectedMainItemId={selectedMainItemId}
            selectedSubItemId={selectedSubItemId}
            editingMainItemId={editingMainItemId}
            editingSubItemId={editingSubItemId}
            editingName={editingName}
            isOperationInProgress={isOperationInProgress}
            operationMessage={operationMessage}
            onSubItemSelect={handleSubItemSelect}
            onMainItemDoubleClick={handleMainItemDoubleClick}
            onSubItemDoubleClick={handleSubItemDoubleClick}
            onDuplicateSubItem={handleDuplicateSubItem}
            onBranchSubItem={handleBranchSubItem}
            onDeleteSubItem={handleDeleteSubItem}
            onEditingNameChange={setEditingName}
            onSaveMainItemName={handleSaveMainItemName}
            onSaveSubItemName={handleSaveSubItemName}
            onCancelEdit={handleCancelEdit}
          />
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
