import { useState, useCallback, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Flex, ActionIcon, Stack, Loader, Text, LoadingOverlay } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { addEdge, useNodesState, useEdgesState, Position, MarkerType, type Connection, type Node, type Edge, type OnSelectionChangeParams } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useProject } from '../hooks/useProject'
import { useFiles } from '../hooks/useFiles'
import { useHierarchy } from '../hooks/useHierarchy'
import { useCanvas } from '../hooks/useCanvas'
import { useNotes } from '../hooks/useNotes'
import { useChat, type AIResponseData } from '../hooks/useChat'
import type { Tag } from '../types/firebase'
import { generateNodesAndEdges } from '../services/ai/nodeGenerator'
import { isAddResponse, isUpdateResponse } from '../services/ai/responseParser'
import { createFileMessage as createMessageInDb, updateFileLastViewed } from '../firebase/database'
import { generateShortId, findFileIdByShortId } from '../utils/fileIdUtils'
import { Header } from './canvas/Header'
import { HierarchySidebar } from './canvas/HierarchySidebar'
import { CanvasArea } from './canvas/CanvasArea'
import { NotesSidebar } from './canvas/NotesSidebar'
import { FileExplorerModal } from './canvas/FileExplorerModal'

interface CanvasPageProps {
  userId: string
}

function CanvasPage({ userId }: CanvasPageProps) {
  // Router hooks
  const { fileId: urlFileId } = useParams<{ fileId?: string }>()
  const navigate = useNavigate()

  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)
  const sidebarWidth = sidebarCollapsed ? 0 : 280
  const rightSidebarWidth = rightSidebarCollapsed ? 0 : 420

  // Selection State
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [selectedMainItemId, setSelectedMainItemId] = useState<string | null>(null)
  const [selectedSubItemId, setSelectedSubItemId] = useState<string | null>(null)

  // Editing State
  const [editingMainItemId, setEditingMainItemId] = useState<string | null>(null)
  const [editingSubItemId, setEditingSubItemId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // File Explorer Modal State
  const [fileExplorerOpened, setFileExplorerOpened] = useState(false)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [editingFileName, setEditingFileName] = useState('')

  // Node Editing State
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  // Edge Editing State
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null)

  // Operation Progress State
  const [isOperationInProgress, setIsOperationInProgress] = useState(false)
  const [operationMessage, setOperationMessage] = useState('')

  // Pending AI drawing state
  const [pendingAIDrawing, setPendingAIDrawing] = useState<AIResponseData | null>(null)

  // File creation loading state
  const [isCreatingFile, setIsCreatingFile] = useState(false)

  // Firebase Hooks
  const { project, isLoading: projectLoading } = useProject(userId)
  const { files, isLoading: filesLoading, updateTags: updateFileTagsLocal, createFile, renameFile, deleteFile } = useFiles(project?.id || null, userId)
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
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([])

  // Tag System State
  const [isTagPopupOpen, setIsTagPopupOpen] = useState(false)
  const [selectedTagsForNodes, setSelectedTagsForNodes] = useState<string[]>([])

  // Notes System
  const {
    notes,
    isLoading: notesLoading,
    addNote: addNoteToDb,
    updateNoteContent: updateNoteInDb,
    deleteNote: deleteNoteFromDb
  } = useNotes(selectedFileId, selectedMainItemId, selectedSubItemId)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [selectedNoteIdFromSidebar, setSelectedNoteIdFromSidebar] = useState<string | null>(null)

  // Chat System
  const {
    messages,
    isLoading: messagesLoading,
    isAIProcessing,
    contextWarning,
    clarificationState,
    sendMessage: sendChatMessage,
    answerClarification,
    cancelClarification,
    refresh: refreshMessages
  } = useChat(selectedFileId, {
    nodes,
    edges,
    selectedNodeIds: selectedNodes.map(n => n.id),
    enableAI: true
  })

  // Get tags from selected file
  const selectedFile = files.find(f => f.id === selectedFileId)
  const fileTags = selectedFile?.data.tags || []

  // Get current main item to find variation index
  const currentMainItem = mainItems.find(m => m.id === selectedMainItemId)
  const variationIndex = currentMainItem?.subItems.findIndex(s => s.id === selectedSubItemId) ?? -1

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
  // Store updateCanvas in ref to avoid dependency issues
  const updateCanvasRef = useRef(updateCanvas)

  // Update ref when updateCanvas changes
  useEffect(() => {
    updateCanvasRef.current = updateCanvas
  }, [updateCanvas])

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

  // Handle URL-based file selection
  useEffect(() => {
    if (files.length === 0) return // Wait for files to load

    if (urlFileId) {
      // Convert short ID from URL to full file ID
      const fullFileId = findFileIdByShortId(urlFileId, files)
      if (fullFileId && fullFileId !== selectedFileId) {
        setSelectedFileId(fullFileId)
      } else if (!fullFileId) {
        // Invalid file ID in URL, redirect to first file or home
        if (files.length > 0) {
          const firstFileId = files[0].id
          setSelectedFileId(firstFileId)
          navigate(`/${generateShortId(firstFileId)}`, { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      }
    } else {
      // No file in URL, auto-select first file and update URL
      if (files.length > 0 && !selectedFileId) {
        const firstFileId = files[0].id
        setSelectedFileId(firstFileId)
        navigate(`/${generateShortId(firstFileId)}`, { replace: true })
      }
    }
  }, [urlFileId, files, selectedFileId, navigate])

  // Track previous file ID to detect file changes
  const previousFileIdRef = useRef<string | null>(null)

  // Clear selection when switching files to allow auto-select logic to load last viewed sub-item
  useEffect(() => {
    // Only clear if file actually changed (not on initial load)
    if (selectedFileId && previousFileIdRef.current !== null && previousFileIdRef.current !== selectedFileId) {
      console.log('[CanvasPage] File changed, clearing selection to load last viewed:', {
        previousFile: previousFileIdRef.current,
        newFile: selectedFileId
      })
      // Clear current selection when file changes to trigger auto-select with last viewed
      setSelectedMainItemId(null)
      setSelectedSubItemId(null)
    }
    previousFileIdRef.current = selectedFileId
  }, [selectedFileId])

  // Auto-select main item and sub-item when hierarchy loads
  // Prioritizes last viewed sub-item, falls back to first main item's default sub-item
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
      const selectedFile = files.find(f => f.id === selectedFileId)
      const lastViewedMainItemId = selectedFile?.data.lastViewedMainItemId
      const lastViewedSubItemId = selectedFile?.data.lastViewedSubItemId

      // Try to load last viewed sub-item if it exists and is valid
      if (lastViewedMainItemId && lastViewedSubItemId) {
        const lastViewedMainItem = mainItems.find(m => m.id === lastViewedMainItemId)
        if (lastViewedMainItem) {
          const lastViewedSubItem = lastViewedMainItem.subItems.find(s => s.id === lastViewedSubItemId)
          if (lastViewedSubItem) {
            console.log('[CanvasPage] Loading last viewed sub-item:', {
              fileId: selectedFileId,
              mainItemId: lastViewedMainItemId,
              subItemId: lastViewedSubItemId
            })
            setSelectedMainItemId(lastViewedMainItemId)
            setSelectedSubItemId(lastViewedSubItemId)
            return
          }
        }
      }

      // Fall back to first main item's default sub-item
      const firstMainItem = mainItems[0]
      console.log('[CanvasPage] Auto-selecting first main item (no last viewed found):', {
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
      } else {
        // Check if the selected sub-item still exists
        const mainItem = mainItems.find(m => m.id === selectedMainItemId)
        if (mainItem && selectedSubItemId) {
          const subItemExists = mainItem.subItems.find(s => s.id === selectedSubItemId)
          if (!subItemExists) {
            // Sub-item was deleted, fall back to default
            console.log('[CanvasPage] Selected sub-item no longer exists, falling back to default')
            setSelectedSubItemId(mainItem.data.defaultSubItemId)
          }
        }
      }
    }
  }, [mainItems, selectedMainItemId, selectedSubItemId, selectedFileId, hierarchyLoading, files])

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

    // If we have a current canvas key and it doesn't match, we're switching - don't save to old location
    if (currentCanvasKey.current && currentCanvasKey.current !== expectedCanvasKey) {
      console.log('[CanvasPage] Skipping save: canvas key mismatch (switching canvases)', {
        current: currentCanvasKey.current,
        expected: expectedCanvasKey
      })
      return
    }

    // Only save if the canvas has been loaded for this key
    // This ensures we don't save before the canvas state has been loaded from the database
    if (lastLoadedCanvasState.current !== expectedCanvasKey) {
      console.log('[CanvasPage] Skipping save: canvas not yet loaded for this key', {
        lastLoaded: lastLoadedCanvasState.current,
        expected: expectedCanvasKey
      })
      return
    }

    // Ensure currentCanvasKey is set (should be set by load effect, but set it here as fallback)
    if (!currentCanvasKey.current) {
      currentCanvasKey.current = expectedCanvasKey
    }

    console.log('[CanvasPage] Canvas changed, scheduling auto-save for:', expectedCanvasKey, 'with', nodes.length, 'nodes,', edges.length, 'edges')

    // Helper function to recursively remove undefined values from an object
    const removeUndefined = (obj: any): any => {
      if (obj === null) {
        return null
      }
      if (Array.isArray(obj)) {
        return obj.map(removeUndefined).filter(item => item !== undefined)
      }
      if (typeof obj === 'object') {
        const cleaned: any = {}
        for (const key in obj) {
          if (obj[key] !== undefined) {
            const cleanedValue = removeUndefined(obj[key])
            if (cleanedValue !== undefined) {
              cleaned[key] = cleanedValue
            }
          }
        }
        return cleaned
      }
      return obj
    }

    // Strip out functions and undefined values from node data before saving to Firebase
    const sanitizedNodes = nodes.map(node => {
      const nodeData: any = {}
      if (node.data.label !== undefined) nodeData.label = node.data.label
      if (node.data.categories !== undefined && node.data.categories !== null) {
        nodeData.categories = Array.isArray(node.data.categories) ? node.data.categories : []
      }
      if (node.data.borderColor !== undefined) nodeData.borderColor = node.data.borderColor
      if (node.data.tags !== undefined && node.data.tags !== null) {
        nodeData.tags = Array.isArray(node.data.tags) ? node.data.tags : []
      }
      // Exclude: isEditing, onLabelChange, onEditingComplete, onAddConnectedNode

      return removeUndefined({
        id: node.id,
        type: node.type,
        position: node.position,
        data: Object.keys(nodeData).length > 0 ? nodeData : {},
        selected: node.selected,
        dragging: node.dragging,
        width: node.width,
        height: node.height,
        style: node.style,
        className: node.className,
        sourcePosition: node.sourcePosition,
        targetPosition: node.targetPosition,
        hidden: node.hidden,
        draggable: node.draggable,
        selectable: node.selectable,
        connectable: node.connectable,
        deletable: node.deletable,
        focusable: node.focusable,
        parentId: node.parentId,
        zIndex: node.zIndex,
        extent: node.extent,
        expandParent: node.expandParent,
        measured: node.measured
      })
    })

    // Strip out functions and undefined values from edge data before saving
    const sanitizedEdges = edges.map(edge => {
      const edgeData: any = {}
      if (edge.data?.label !== undefined) edgeData.label = edge.data.label

      const edgeObj: any = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: edge.type,
        animated: edge.animated,
        hidden: edge.hidden,
        deletable: edge.deletable,
        focusable: edge.focusable,
        selectable: edge.selectable,
        markerStart: edge.markerStart,
        markerEnd: edge.markerEnd,
        label: edge.label,
        labelStyle: edge.labelStyle,
        labelShowBg: edge.labelShowBg,
        labelBgStyle: edge.labelBgStyle,
        labelBgPadding: edge.labelBgPadding,
        labelBgBorderRadius: edge.labelBgBorderRadius,
        style: edge.style,
        className: edge.className,
        zIndex: edge.zIndex
      }

      // Only include data if it has content
      if (Object.keys(edgeData).length > 0) {
        edgeObj.data = edgeData
      }

      return removeUndefined(edgeObj)
    })

    updateCanvasRef.current({
      nodes: sanitizedNodes as any,
      edges: sanitizedEdges as any,
      viewport: { x: 0, y: 0, zoom: 1 }
    })
  }, [nodes, edges, selectedFileId, selectedMainItemId, selectedSubItemId])

  const onConnect = useCallback(
    (params: Connection) => {
      // Ensure handle IDs are set for proper detection
      const newEdge = {
        ...params,
        sourceHandle: params.sourceHandle || 'right-source', // Default to right if not specified
        targetHandle: params.targetHandle || 'left-target',   // Default to left if not specified
        markerEnd: { type: MarkerType.ArrowClosed } // Add arrow head by default
      }
      setEdges((eds) => addEdge(newEdge, eds))
    },
    [setEdges]
  )

  // Helper function to get node dimensions
  const getNodeDimensions = useCallback((nodeType: string, label?: string): { width: number; height: number } => {
    switch (nodeType) {
      case 'circle':
        return { width: 100, height: 100 }
      case 'rectangle':
        // Estimate width based on label length (rough estimate: 8px per character + padding)
        const estimatedWidth = label ? Math.max(80, label.length * 8 + 40) : 100
        return { width: estimatedWidth, height: 40 } // Height is padding 10px top + 10px bottom + ~20px for text
      case 'diamond':
        return { width: 100, height: 100 }
      case 'triangle':
        return { width: 100, height: 100 }
      default:
        return { width: 100, height: 100 }
    }
  }, [])

  const addNode = useCallback((nodeType: 'rectangle' | 'circle', getViewport?: () => { x: number; y: number; zoom: number } | null) => {
    // Count existing nodes of the same type to get the next number
    const existingCount = nodes.filter(n => n.type === nodeType).length
    const nodeNumber = existingCount + 1
    const nodeLabel = nodeType === 'circle' 
      ? `Thinking Node ${nodeNumber}`
      : `Idea Node ${nodeNumber}`
    
    // Calculate smart position based on viewport and existing nodes
    let position: { x: number; y: number }
    
    if (getViewport) {
      const viewport = getViewport()
      if (viewport) {
        // Get viewport bounds in flow coordinates
        const pane = document.querySelector('.react-flow__pane') as HTMLElement
        if (pane) {
          const rect = pane.getBoundingClientRect()
          const viewportWidth = rect.width / viewport.zoom
          const viewportHeight = rect.height / viewport.zoom
          
          // Calculate viewport bounds in flow coordinates
          const viewportMinX = -viewport.x / viewport.zoom
          const viewportMinY = -viewport.y / viewport.zoom
          const viewportMaxX = viewportMinX + viewportWidth
          const viewportMaxY = viewportMinY + viewportHeight
          
          // Find nodes that are visible in the viewport
          const nodesInViewport = nodes.filter(node => {
            const nodeDims = getNodeDimensions(node.type || 'rectangle', node.data?.label)
            const nodeRight = node.position.x + nodeDims.width
            const nodeBottom = node.position.y + nodeDims.height
            
            return node.position.x < viewportMaxX && 
                   nodeRight > viewportMinX &&
                   node.position.y < viewportMaxY &&
                   nodeBottom > viewportMinY
          })
          
          if (nodesInViewport.length > 0) {
            // Position near existing nodes in viewport
            // Calculate average position
            const avgX = nodesInViewport.reduce((sum, n) => {
              const dims = getNodeDimensions(n.type || 'rectangle', n.data?.label)
              return sum + n.position.x + dims.width / 2
            }, 0) / nodesInViewport.length
            
            const avgY = nodesInViewport.reduce((sum, n) => {
              const dims = getNodeDimensions(n.type || 'rectangle', n.data?.label)
              return sum + n.position.y + dims.height / 2
            }, 0) / nodesInViewport.length
            
            // Find the rightmost node to place new node to the right
            const rightmostNode = nodesInViewport.reduce((max, node) => {
              const maxDims = getNodeDimensions(max.type || 'rectangle', max.data?.label)
              const nodeDims = getNodeDimensions(node.type || 'rectangle', node.data?.label)
              return (node.position.x + nodeDims.width) > (max.position.x + maxDims.width) ? node : max
            })
            
            const rightmostDims = getNodeDimensions(rightmostNode.type || 'rectangle', rightmostNode.data?.label)
            const newNodeDims = getNodeDimensions(nodeType, nodeLabel)
            const spacing = 50
            
            // Position to the right of the rightmost node, but keep within viewport
            let newX = rightmostNode.position.x + rightmostDims.width + spacing
            let newY = rightmostNode.position.y
            
            // Ensure it's within viewport bounds (with some padding)
            const padding = 20
            if (newX + newNodeDims.width > viewportMaxX - padding) {
              // If too far right, place below the rightmost node
              newX = rightmostNode.position.x
              newY = rightmostNode.position.y + rightmostDims.height + spacing
            }
            
            // Ensure Y is within viewport
            if (newY + newNodeDims.height > viewportMaxY - padding) {
              newY = viewportMinY + padding
            }
            
            position = { x: newX, y: newY }
          } else {
            // No nodes in viewport, place in center of viewport
            const newNodeDims = getNodeDimensions(nodeType, nodeLabel)
            position = {
              x: (viewportMinX + viewportMaxX) / 2 - newNodeDims.width / 2,
              y: (viewportMinY + viewportMaxY) / 2 - newNodeDims.height / 2
            }
          }
        } else {
          // Fallback if pane not found
          position = { x: 400, y: 300 }
        }
      } else {
        // Fallback if viewport not available
        position = { x: 400, y: 300 }
      }
    } else {
      // Fallback if getViewport not provided
      position = { x: 400, y: 300 }
    }
    
    const newNode: Node = {
      id: `${nodeIdCounter}`,
      type: nodeType,
      data: { label: nodeLabel },
      position
    }
    setNodes((nds) => [...nds, newNode])
    setNodeIdCounter((id) => id + 1)
  }, [nodeIdCounter, nodes, setNodes, getNodeDimensions])

  const clearCanvas = useCallback(() => {
    setNodes([])
    setEdges([])
    setNodeIdCounter(1)
  }, [setNodes, setEdges])

  // Add connected node from an unconnected handle
  const addConnectedNode = useCallback((sourceNodeId: string, handlePosition: Position, nodeType: string) => {
    // Use functional update to avoid dependency on nodes
    setNodes((currentNodes) => {
      // Get the source node to calculate position
      const sourceNode = currentNodes.find(n => n.id === sourceNodeId)
      if (!sourceNode) return currentNodes

      // Count existing nodes of the same type to get the next number
      const existingCount = currentNodes.filter(n => n.type === nodeType).length
      const nodeNumber = existingCount + 1
      const newNodeLabel = nodeType === 'circle'
        ? `Thinking Node ${nodeNumber}`
        : `Idea Node ${nodeNumber}`

      // Get dimensions of source and new node
      const sourceDims = getNodeDimensions(sourceNode.type || 'rectangle', sourceNode.data?.label)
      const newDims = getNodeDimensions(nodeType, newNodeLabel)

      // Calculate center of source node
      const sourceCenterX = sourceNode.position.x + sourceDims.width / 2
      const sourceCenterY = sourceNode.position.y + sourceDims.height / 2

      // Calculate position for new node based on handle position
      // Offset includes spacing between nodes + half of each node's dimension
      const spacing = 50 // Space between nodes
      const offset = spacing + (sourceDims.width + newDims.width) / 2
      const verticalOffset = spacing + (sourceDims.height + newDims.height) / 2

      let newCenterX = sourceCenterX
      let newCenterY = sourceCenterY

      switch (handlePosition) {
        case Position.Top:
          newCenterY = sourceCenterY - verticalOffset
          break
        case Position.Bottom:
          newCenterY = sourceCenterY + verticalOffset
          break
        case Position.Left:
          newCenterX = sourceCenterX - offset
          break
        case Position.Right:
          newCenterX = sourceCenterX + offset
          break
      }

      // Convert center position back to top-left position for React Flow
      const newPosition = {
        x: newCenterX - newDims.width / 2,
        y: newCenterY - newDims.height / 2
      }

      // Create new node
      const newNodeId = `${nodeIdCounter}`
      const newNode: Node = {
        id: newNodeId,
        type: nodeType,
        data: { label: newNodeLabel },
        position: newPosition
      }

      // Determine target handle (opposite of source handle)
      const oppositeHandle: Record<Position, string> = {
        [Position.Top]: 'bottom-target',
        [Position.Bottom]: 'top-target',
        [Position.Left]: 'right-target',
        [Position.Right]: 'left-target'
      }

      // Create edge connecting the nodes
      const newEdge: Edge = {
        id: `e${sourceNodeId}-${newNodeId}`,
        source: sourceNodeId,
        target: newNodeId,
        sourceHandle: `${handlePosition.toLowerCase()}-source`,
        targetHandle: oppositeHandle[handlePosition],
        markerEnd: { type: MarkerType.ArrowClosed } // Add arrow head by default
      }

      // Add edge
      setEdges((eds) => [...eds, newEdge])
      setNodeIdCounter((id) => id + 1)

      // Return new nodes array
      return [...currentNodes, newNode]
    })
  }, [nodeIdCounter, getNodeDimensions, setNodes, setEdges])

  // Handle selection changes
  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodes(params.nodes)
    setSelectedEdges(params.edges)
  }, [])

  // Delete selected edges
  const deleteSelectedEdges = useCallback(() => {
    if (selectedEdges.length === 0) return
    
    const edgeIdsToDelete = selectedEdges.map(edge => edge.id)
    setEdges((eds) => eds.filter(edge => !edgeIdsToDelete.includes(edge.id)))
    setSelectedEdges([])
  }, [selectedEdges, setEdges])

  // Handle keyboard shortcuts for deleting edges
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle Delete/Backspace if no input is focused
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      // Delete selected edges with Delete or Backspace
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEdges.length > 0) {
        event.preventDefault()
        event.stopPropagation()
        deleteSelectedEdges()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true) // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [selectedEdges, deleteSelectedEdges])

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

  // Store callback in ref to avoid recreating node data constantly
  const addConnectedNodeRef = useRef(addConnectedNode)

  useEffect(() => {
    addConnectedNodeRef.current = addConnectedNode
  }, [addConnectedNode])

  // Update nodes with editing state and handlers
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        draggable: editingNodeId !== node.id, // Disable dragging when editing
        data: {
          ...node.data,
          isEditing: editingNodeId === node.id,
          onLabelChange: (value: string) => handleNodeLabelChange(node.id, value),
          onEditingComplete: handleNodeEditingComplete,
          onAddConnectedNode: (nodeId: string, position: Position, nodeType: string) =>
            addConnectedNodeRef.current(nodeId, position, nodeType)
        }
      }))
    )
  }, [editingNodeId, handleNodeLabelChange, handleNodeEditingComplete, nodes.length])

  // Update edges with editing state and handlers
  useEffect(() => {
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        selectable: true, // Ensure all edges are selectable
        deletable: true, // Ensure all edges are deletable
        data: {
          ...edge.data,
          isEditing: editingEdgeId === edge.id,
          onLabelChange: (value: string) => handleEdgeLabelChange(edge.id, value),
          onEditingComplete: handleEdgeEditingComplete
        }
      }))
    )
  }, [editingEdgeId, handleEdgeLabelChange, handleEdgeEditingComplete])



  const handleSubItemSelect = async (mainItemId: string, subItemId: string) => {
    console.log('[CanvasPage] Selecting sub-item:', { mainItemId, subItemId })
    // Immediately mark as loading to prevent saves during transition
    isLoadingCanvas.current = true
    // Clear the current canvas key to prevent saves to old location
    currentCanvasKey.current = null
    setSelectedMainItemId(mainItemId)
    setSelectedSubItemId(subItemId)

    // Save the last viewed sub-item for this file
    if (selectedFileId) {
      try {
        await updateFileLastViewed(selectedFileId, mainItemId, subItemId)
        console.log('[CanvasPage] Saved last viewed sub-item for file:', selectedFileId)
      } catch (error) {
        console.error('[CanvasPage] Error saving last viewed sub-item:', error)
        // Don't block the selection if save fails
      }
    }
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
      const newMainItemName = `Exploration ${count + 1}`

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
    setEditingMainItemId(null)
    setEditingSubItemId(null)
    setEditingName('')
  }

  // Notes handlers
  const handleAddNote = useCallback(async (x: number, y: number) => {
    console.log('handleAddNote called with:', { x, y })
    const noteId = await addNoteToDb('', x, y)
    if (noteId) {
      setActiveNoteId(noteId)
    }
  }, [addNoteToDb])

  const handleUpdateNote = useCallback(async (id: string, content: string) => {
    await updateNoteInDb(id, content)
  }, [updateNoteInDb])

  const handleDeleteNote = useCallback(async (id: string) => {
    await deleteNoteFromDb(id)
    setActiveNoteId(null)
  }, [deleteNoteFromDb])

  const handleNoteClick = useCallback((id: string) => {
    // Force immediate rendering of popup
    flushSync(() => {
      setActiveNoteId(id)
    })
  }, [])

  const handleNoteClose = useCallback(() => {
    setActiveNoteId(null)
  }, [])

  // Execute AI drawing (actually add nodes/edges to canvas)
  const executeAIDrawing = useCallback(async (aiResponse: AIResponseData) => {
    try {
      // Type guard: ensure it's an ADD response
      if (!isAddResponse(aiResponse.response)) {
        console.warn('[CanvasPage] Response is not an ADD response')
        return
      }

      // Validate response has nodes
      if (!aiResponse.response.nodes || !Array.isArray(aiResponse.response.nodes) || aiResponse.response.nodes.length === 0) {
        console.warn('[CanvasPage] No nodes to add from AI response')
        return
      }

      // Generate nodes and edges from AI response
      const generateResult = generateNodesAndEdges(
        aiResponse.response.nodes,
        aiResponse.response.edges || [],
        {
          existingNodes: nodes,
          existingEdges: edges,
          nodeIdCounter
        }
      )

      // Add generated nodes to canvas
      if (generateResult.nodes.length > 0) {
        setNodes((nds) => [...nds, ...generateResult.nodes])
        setNodeIdCounter(generateResult.nextNodeIdCounter)
      }

      // Add generated edges to canvas
      if (generateResult.edges.length > 0) {
        setEdges((eds) => [...eds, ...generateResult.edges])
      }

      // Show warnings if any
      if (generateResult.warnings.length > 0) {
        console.warn('[CanvasPage] Node generation warnings:', generateResult.warnings)
      }

      // Show errors if any
      if (generateResult.errors.length > 0) {
        console.error('[CanvasPage] Node generation errors:', generateResult.errors)
      }

      // Save assistant message confirming the drawing
      if (selectedFileId) {
        try {
          const confirmationMessage = aiResponse.response.explanation || 
            `Added ${generateResult.nodes.length} node(s)${generateResult.edges.length > 0 ? ` and ${generateResult.edges.length} edge(s)` : ''} to the canvas.`
          await createMessageInDb(
            selectedFileId,
            'assistant',
            confirmationMessage
          )
          await refreshMessages()
        } catch (error) {
          console.error('[CanvasPage] Error saving confirmation message:', error)
        }
      }
    } catch (error: any) {
      console.error('[CanvasPage] Error executing AI drawing:', error)
      // Save error message directly (without triggering AI)
      if (selectedFileId) {
        try {
          await createMessageInDb(
            selectedFileId,
            'assistant',
            `Error adding nodes: ${error.message || 'Unknown error'}`
          )
          await refreshMessages()
        } catch (saveError) {
          console.error('[CanvasPage] Error saving error message:', saveError)
        }
      }
    }
  }, [nodes, edges, nodeIdCounter, setNodes, setEdges, setNodeIdCounter, selectedFileId, refreshMessages])

  // Handle UPDATE response - ask for permission before updating nodes
  const handleUpdateResponse = useCallback(async (aiResponse: AIResponseData) => {
    try {
      // Type guard: ensure it's an UPDATE response
      if (!isUpdateResponse(aiResponse.response)) {
        console.warn('[CanvasPage] Response is not an UPDATE response')
        return
      }

      // Validate response has node updates
      if (!aiResponse.response.nodeUpdates || !Array.isArray(aiResponse.response.nodeUpdates) || aiResponse.response.nodeUpdates.length === 0) {
        console.warn('[CanvasPage] No node updates to apply from AI response')
        return
      }

      // Store pending update
      setPendingAIDrawing(aiResponse)

      // Get current version name
      const currentSubItem = currentMainItem?.subItems.find(s => s.id === selectedSubItemId)
      const versionName = currentSubItem?.data.name || `V${variationIndex + 1}`

      // Build permission request message
      const updateDescriptions = aiResponse.response.nodeUpdates.map(update => {
        const identifier = update.nodeId || update.nodeLabel || 'Unknown'
        return `"${identifier}" → "${update.newLabel}"`
      })
      
      let permissionMessage = `I can update ${aiResponse.response.nodeUpdates.length} node label(s) in "${versionName}":\n\n`
      updateDescriptions.forEach((desc, idx) => {
        permissionMessage += `${idx + 1}. ${desc}\n`
      })
      permissionMessage += `\n${aiResponse.response.explanation || ''}\n\nWould you like me to proceed? (Reply "yes" to confirm or "no" to cancel)`

      // Save permission request message (without triggering AI)
      if (selectedFileId) {
        try {
          await createMessageInDb(
            selectedFileId,
            'assistant',
            permissionMessage
          )
          await refreshMessages()
        } catch (error) {
          console.error('[CanvasPage] Error saving permission message:', error)
        }
      }
    } catch (error) {
      console.error('[CanvasPage] Error handling UPDATE response:', error)
    }
  }, [selectedFileId, refreshMessages, currentMainItem, selectedSubItemId, variationIndex])

  // Execute AI update (actually update node labels on canvas)
  const executeAIUpdate = useCallback(async (aiResponse: AIResponseData) => {
    try {
      // Type guard: ensure it's an UPDATE response
      if (!isUpdateResponse(aiResponse.response)) {
        console.warn('[CanvasPage] Response is not an UPDATE response')
        return
      }

      // Now TypeScript knows it's an UPDATE response
      const updateResponse = aiResponse.response

      // Validate response has node updates
      if (!updateResponse.nodeUpdates || !Array.isArray(updateResponse.nodeUpdates) || updateResponse.nodeUpdates.length === 0) {
        console.warn('[CanvasPage] No node updates to apply from AI response')
        return
      }

      // Create a label-to-ID mapping for existing nodes
      const labelToIdMap = new Map<string, string>()
      nodes.forEach(node => {
        const label = (node.data as any)?.label
        if (label && typeof label === 'string') {
          // Use first match (if multiple nodes have same label, use first one)
          if (!labelToIdMap.has(label.toLowerCase())) {
            labelToIdMap.set(label.toLowerCase(), node.id)
          }
        }
      })

      // Apply updates
      let updateCount = 0
      const errors: string[] = []

      setNodes((nds) => {
        return nds.map((node) => {
          // Check if this node should be updated
          for (const update of updateResponse.nodeUpdates) {
            let shouldUpdate = false

            // Check by nodeId first (preferred)
            if (update.nodeId && node.id === update.nodeId) {
              shouldUpdate = true
            }
            // Check by nodeLabel if nodeId not provided
            else if (update.nodeLabel) {
              const nodeLabel = (node.data as any)?.label
              if (nodeLabel && typeof nodeLabel === 'string' && 
                  nodeLabel.toLowerCase() === update.nodeLabel.toLowerCase()) {
                shouldUpdate = true
              }
            }

            if (shouldUpdate) {
              updateCount++
              return {
                ...node,
                data: {
                  ...node.data,
                  label: update.newLabel
                }
              }
            }
          }
          return node
        })
      })

      if (updateCount === 0) {
        errors.push('No matching nodes found to update')
      }

      // Show errors if any
      if (errors.length > 0) {
        console.error('[CanvasPage] Node update errors:', errors)
      }

      // Save assistant message confirming the update
      if (selectedFileId) {
        try {
          const confirmationMessage = updateCount > 0
            ? `Updated ${updateCount} node label(s)${errors.length > 0 ? `. Some updates failed: ${errors.join(', ')}` : ''}.`
            : `Failed to update nodes: ${errors.join(', ')}.`

          await createMessageInDb(
            selectedFileId,
            'assistant',
            confirmationMessage
          )
          await refreshMessages()
        } catch (saveError) {
          console.error('[CanvasPage] Error saving confirmation message:', saveError)
        }
      }
    } catch (error) {
      console.error('[CanvasPage] Error executing AI update:', error)
    }
  }, [nodes, setNodes, selectedFileId, refreshMessages])

  // Handle ADD response - ask for permission instead of immediately drawing
  const handleAddResponse = useCallback(async (aiResponse: AIResponseData) => {
    try {
      // Type guard: ensure it's an ADD response
      if (!isAddResponse(aiResponse.response)) {
        console.warn('[CanvasPage] Response is not an ADD response')
        return
      }

      // Validate response has nodes
      if (!aiResponse.response.nodes || !Array.isArray(aiResponse.response.nodes) || aiResponse.response.nodes.length === 0) {
        console.warn('[CanvasPage] No nodes to add from AI response')
        return
      }

      // Store pending drawing
      setPendingAIDrawing(aiResponse)

      // Get current version name
      const currentSubItem = currentMainItem?.subItems.find(s => s.id === selectedSubItemId)
      const versionName = currentSubItem?.data.name || `V${variationIndex + 1}`

      // Build permission request message
      const nodeLabels = aiResponse.response.nodes.map(n => n.label).filter(Boolean)
      const nodeCount = aiResponse.response.nodes.length
      const edgeCount = aiResponse.response.edges?.length || 0
      
      let permissionMessage = `I can add ${nodeCount} node(s)`
      if (nodeLabels.length > 0 && nodeLabels.length <= 5) {
        permissionMessage += `: ${nodeLabels.join(', ')}`
      } else if (nodeLabels.length > 5) {
        permissionMessage += `: ${nodeLabels.slice(0, 5).join(', ')} and ${nodeLabels.length - 5} more`
      }
      if (edgeCount > 0) {
        permissionMessage += ` and ${edgeCount} edge(s)`
      }
      permissionMessage += ` to the canvas in "${versionName}".\n\nWould you like me to proceed? (Reply "yes" to confirm or "no" to cancel)`

      // Save permission request message (without triggering AI)
      if (selectedFileId) {
        try {
          await createMessageInDb(
            selectedFileId,
            'assistant',
            permissionMessage
          )
          await refreshMessages()
        } catch (error) {
          console.error('[CanvasPage] Error saving permission request:', error)
        }
      }
    } catch (error: any) {
      console.error('[CanvasPage] Error processing AI ADD response:', error)
      // Save error message directly (without triggering AI)
      if (selectedFileId) {
        try {
          await createMessageInDb(
            selectedFileId,
            'assistant',
            `Error processing request: ${error.message || 'Unknown error'}`
          )
          await refreshMessages()
        } catch (saveError) {
          console.error('[CanvasPage] Error saving error message:', saveError)
        }
      }
    }
  }, [selectedFileId, refreshMessages, currentMainItem, selectedSubItemId, variationIndex])

  // Handle sending chat message with AI response processing
  const handleSendMessage = useCallback(async (content: string) => {
    // Check if user is confirming a pending action
    const isConfirmation = /^(yes|yep|yeah|ok|okay|proceed|go ahead|do it|confirm|approved?)$/i.test(content.trim())
    
    if (isConfirmation && pendingAIDrawing) {
      // User confirmed, proceed with action
      if (isAddResponse(pendingAIDrawing.response)) {
        await executeAIDrawing(pendingAIDrawing)
      } else if (isUpdateResponse(pendingAIDrawing.response)) {
        await executeAIUpdate(pendingAIDrawing)
      }
      setPendingAIDrawing(null)
      return null
    }

    // Check if user is rejecting
    const isRejection = /^(no|nope|nah|cancel|stop|don't|dont)$/i.test(content.trim())
    if (isRejection && pendingAIDrawing) {
      // User rejected, clear pending action
      const actionType = isAddResponse(pendingAIDrawing.response) ? 'add those nodes' : 
                        isUpdateResponse(pendingAIDrawing.response) ? 'update those nodes' : 
                        'perform that action'
      if (selectedFileId) {
        await createMessageInDb(
          selectedFileId,
          'assistant',
          `Understood. I won't ${actionType}. How else can I help?`
        )
        await refreshMessages()
      }
      setPendingAIDrawing(null)
      return null
    }

    const result = await sendChatMessage(content)

    // Handle AI response if present
    if (result.aiResponse) {
      if (isAddResponse(result.aiResponse.response)) {
        await handleAddResponse(result.aiResponse)
      } else if (isUpdateResponse(result.aiResponse.response)) {
        await handleUpdateResponse(result.aiResponse)
      }
    }

    return result.messageId
  }, [sendChatMessage, pendingAIDrawing, executeAIDrawing, executeAIUpdate, handleAddResponse, handleUpdateResponse, selectedFileId, refreshMessages])

  // Handle clarification answer
  const handleAnswerClarification = useCallback(async (questionIndex: number, answer: string) => {
    const aiResponse = await answerClarification(questionIndex, answer)
    if (aiResponse) {
      if (isAddResponse(aiResponse.response)) {
        await handleAddResponse(aiResponse)
      } else if (isUpdateResponse(aiResponse.response)) {
        await handleUpdateResponse(aiResponse)
      }
    }
  }, [answerClarification, handleAddResponse, handleUpdateResponse])

  // Clear pending drawing when switching contexts
  useEffect(() => {
    setPendingAIDrawing(null)
  }, [selectedFileId, selectedMainItemId, selectedSubItemId])

  // Reset active note when variation changes
  useEffect(() => {
    setActiveNoteId(null)
  }, [selectedSubItemId])

  // Refresh messages when file changes to ensure welcome message is loaded
  // This handles the case where a new file is created and the welcome message
  // might not be immediately available due to Firestore propagation delay
  useEffect(() => {
    if (selectedFileId && !messagesLoading) {
      // If we just loaded and have no messages, wait a bit and refresh
      // This ensures the welcome message (created during file creation) is loaded
      if (messages.length === 0) {
        const timeoutId = setTimeout(() => {
          refreshMessages()
        }, 1500) // Give Firestore time to propagate the welcome message
        return () => clearTimeout(timeoutId)
      }
    }
  }, [selectedFileId, messagesLoading, messages.length, refreshMessages])

  // File operation handlers
  const handleCreateFile = useCallback(async () => {
    setIsCreatingFile(true)
    try {
      const fileId = await createFile('Untitled')
      if (fileId) {
        setSelectedFileId(fileId)
        navigate(`/${generateShortId(fileId)}`)
        setFileExplorerOpened(false)
      }
    } finally {
      setIsCreatingFile(false)
    }
  }, [createFile, navigate])

  const handleFileSelect = useCallback((fileId: string) => {
    setSelectedFileId(fileId)
    navigate(`/${generateShortId(fileId)}`)
    setFileExplorerOpened(false)
  }, [navigate])

  const handleFileDoubleClick = useCallback((fileId: string, currentName: string) => {
    setEditingFileId(fileId)
    setEditingFileName(currentName)
  }, [])

  const handleSaveFileName = useCallback(async (fileId: string) => {
    if (editingFileName.trim()) {
      await renameFile(fileId, editingFileName.trim())
    }
    setEditingFileId(null)
    setEditingFileName('')
  }, [editingFileName, renameFile])

  const handleCancelFileEdit = useCallback(() => {
    setEditingFileId(null)
    setEditingFileName('')
  }, [])

  const handleDeleteFile = useCallback(async (fileId: string) => {
    if (confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      const success = await deleteFile(fileId)
      if (success && selectedFileId === fileId) {
        // If we deleted the currently selected file, select another one or clear selection
        const remainingFiles = files.filter(f => f.id !== fileId)
        if (remainingFiles.length > 0) {
          const newFileId = remainingFiles[0].id
          setSelectedFileId(newFileId)
          navigate(`/${generateShortId(newFileId)}`)
        } else {
          setSelectedFileId(null)
          navigate('/')
        }
      }
    }
  }, [deleteFile, selectedFileId, files, navigate])

  // Show loading state
  if (projectLoading || filesLoading) {
    return (
      <Box style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-secondary)',
        transition: 'background-color 0.3s ease'
      }}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading ThinkLoops...</Text>
        </Stack>
      </Box>
    )
  }

  return (
    <Box
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative'
      }}
    >
      <LoadingOverlay
        visible={isCreatingFile}
        overlayProps={{ blur: 2 }}
        loaderProps={{
          children: (
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text size="lg" fw={500} c="dimmed">
                Creating new idea...
              </Text>
            </Stack>
          )
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999
        }}
      />
    <Box
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        margin: 0,
        padding: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        transition: 'background-color 0.3s ease'
      }}
    >
      {/* Header Bar */}
      <Header
        selectedFile={selectedFile}
        isSaving={isSaving}
        onOpenFileExplorer={() => setFileExplorerOpened(true)}
        onCreateFile={handleCreateFile}
        onRenameFile={async (fileId, newName) => {
          await renameFile(fileId, newName)
        }}
      />

      {/* Main content area with sidebar */}
      <Flex style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Left Sidebar - Hierarchy (Versions) */}
        <Box
          style={{
            width: sidebarWidth,
            backgroundColor: 'var(--bg-primary)',
            borderRight: sidebarCollapsed ? 'none' : '1px solid var(--border-color)',
            transition: 'width 0.3s ease, background-color 0.3s ease, border-color 0.3s ease',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}
        >
          <HierarchySidebar
            isCollapsed={sidebarCollapsed}
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

        {/* Left Sidebar toggle button */}
        <ActionIcon
          size="md"
          variant="subtle"
          color="gray"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            position: 'absolute',
            left: sidebarCollapsed ? '8px' : `${sidebarWidth - 12}px`,
            top: '16px',
            transition: 'left 0.3s ease, background-color 0.3s ease, border-color 0.3s ease',
            zIndex: 5,
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
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
            editingNodeId={editingNodeId}
            onAddNode={addNode}
            onClearCanvas={clearCanvas}
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
            notes={notes}
            onAddNote={handleAddNote}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
            activeNoteId={activeNoteId}
            onNoteClick={handleNoteClick}
            onNoteClose={handleNoteClose}
            selectedNoteIdFromSidebar={selectedNoteIdFromSidebar}
            onCanvasClick={() => setSelectedNoteIdFromSidebar(null)}
          />
        </Box>

        {/* Right Sidebar - Notes */}
        <Box
          style={{
            width: rightSidebarWidth,
            height: '100%',
            transition: 'width 0.3s ease',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <NotesSidebar
            isCollapsed={rightSidebarCollapsed}
            variationId={selectedSubItemId}
            variationIndex={variationIndex}
            mainItemSubItems={currentMainItem?.subItems}
            notes={notes}
            isLoading={notesLoading}
            onDeleteNote={handleDeleteNote}
            onNoteClick={setSelectedNoteIdFromSidebar}
            selectedNoteId={selectedNoteIdFromSidebar}
            messages={messages}
            isLoadingMessages={messagesLoading}
            isAIProcessing={isAIProcessing}
            contextWarning={contextWarning}
            clarificationState={clarificationState}
            onSendMessage={handleSendMessage}
            onAnswerClarification={handleAnswerClarification}
            onCancelClarification={cancelClarification}
            pendingAIDrawing={pendingAIDrawing}
            onApplyDrawing={async () => {
              if (pendingAIDrawing) {
                // Clear pending drawing immediately to disable buttons
                const aiResponse = pendingAIDrawing
                setPendingAIDrawing(null)
                
                if (isAddResponse(aiResponse.response)) {
                  await executeAIDrawing(aiResponse)
                } else if (isUpdateResponse(aiResponse.response)) {
                  await executeAIUpdate(aiResponse)
                }
              }
            }}
            onDuplicateDrawing={async () => {
              if (pendingAIDrawing && selectedFileId && selectedMainItemId && selectedSubItemId) {
                // Clear pending drawing immediately to disable buttons
                const aiResponse = pendingAIDrawing
                setPendingAIDrawing(null)
                
                // First duplicate the current state (before applying changes)
                // This creates v2 with the current state (without the pending changes)
                await handleDuplicateSubItem(selectedMainItemId, selectedSubItemId)
                
                // Wait a bit for the duplicate to complete and switch to the new sub-item
                setTimeout(async () => {
                  if (selectedFileId && selectedMainItemId && selectedSubItemId) {
                    // Now apply the changes to the new duplicated sub-item (v2)
                    // The selectedSubItemId should now be the new duplicate
                    if (isAddResponse(aiResponse.response)) {
                      await executeAIDrawing(aiResponse)
                    } else if (isUpdateResponse(aiResponse.response)) {
                      await executeAIUpdate(aiResponse)
                    }
                  }
                }, 1000) // Wait for duplicate to complete and switch
              }
            }}
            onBranchAsMain={async () => {
              if (pendingAIDrawing && selectedFileId && selectedMainItemId && selectedSubItemId) {
                // Clear pending drawing immediately to disable buttons
                const aiResponse = pendingAIDrawing
                setPendingAIDrawing(null)
                
                // First branch the current state (before applying changes)
                // This creates a new main item with the current state (without the pending changes)
                await handleBranchSubItem(selectedMainItemId, selectedSubItemId)
                
                // Wait a bit for the branch to complete and switch to the new main item
                setTimeout(async () => {
                  if (selectedFileId && selectedMainItemId && selectedSubItemId) {
                    // Now apply the changes to the new branched main item
                    // The selectedMainItemId and selectedSubItemId should now be the new branch
                    if (isAddResponse(aiResponse.response)) {
                      await executeAIDrawing(aiResponse)
                    } else if (isUpdateResponse(aiResponse.response)) {
                      await executeAIUpdate(aiResponse)
                    }
                  }
                }, 1000) // Wait for branch to complete and switch
              }
            }}
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
            transition: 'right 0.3s ease, background-color 0.3s ease, border-color 0.3s ease',
            zIndex: 5,
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px'
          }}
        >
          {rightSidebarCollapsed ? <IconChevronLeft size={18} /> : <IconChevronRight size={18} />}
        </ActionIcon>
      </Flex>

      {/* File Explorer Modal */}
      <FileExplorerModal
        opened={fileExplorerOpened}
        onClose={() => setFileExplorerOpened(false)}
        files={files}
        filesLoading={filesLoading}
        selectedFileId={selectedFileId}
        editingFileId={editingFileId}
        editingName={editingFileName}
        onCreateFile={handleCreateFile}
        onFileSelect={handleFileSelect}
        onFileDoubleClick={handleFileDoubleClick}
        onDeleteFile={handleDeleteFile}
        onEditingNameChange={setEditingFileName}
        onSaveFileName={handleSaveFileName}
        onCancelEdit={handleCancelFileEdit}
      />
    </Box>
    </Box>
  )
}

export default CanvasPage
