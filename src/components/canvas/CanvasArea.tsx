import { Box, Flex, Stack, Text, Loader, Paper, ActionIcon } from '@mantine/core'
import { ReactFlow, Background, Controls, MiniMap, BackgroundVariant, MarkerType, type Node, type Edge, type OnNodesChange, type OnEdgesChange, type Connection, type OnSelectionChangeParams, type ReactFlowInstance } from '@xyflow/react'
import { IconSquare, IconCircle, IconFileText, IconMessageCircle } from '@tabler/icons-react'
import { NoteDot } from './NoteDot'
import { NotePopup } from './NotePopup'
import { useCallback, useRef, useState, useEffect, useMemo } from 'react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from './NodeComponents'
import { edgeTypes } from './EdgeComponents'
import { TagPopup } from './TagPopup'
import { FloatingColorBar } from './FloatingColorBar'
import type { Tag } from '../../types/firebase'

interface Note {
  id: string
  x: number
  y: number
  content: string
}

interface CanvasAreaProps {
  selectedFileId: string | null
  canvasLoading: boolean
  nodes: Node[]
  edges: Edge[]
  selectedNodes: Node[]
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: (connection: Connection) => void
  onSelectionChange: (params: OnSelectionChangeParams) => void
  onNodeDoubleClick: (event: React.MouseEvent, node: Node) => void
  onEdgeDoubleClick: (event: React.MouseEvent, edge: Edge) => void
  onAddNode: (nodeType: 'rectangle' | 'circle', getViewport?: () => { x: number; y: number; zoom: number } | null) => void
  // Tag System
  isTagPopupOpen: boolean
  selectedTagsForNodes: string[]
  fileTags: Tag[]
  onTagClick: () => void
  onTagPopupClose: () => void
  onTagToggle: (tag: string) => void
  onAddTag: (tagName: string, color: string) => void
  onRemoveTag: (tagName: string) => void
  // Color System
  colors: { name: string; value: string }[]
  updateNodeColor: (color: string) => void
  updateNodeType: (nodeType: 'rectangle' | 'circle') => void
  // Notes System
  notes: Note[]
  onAddNote: (x: number, y: number) => void
  onUpdateNote: (id: string, content: string) => void
  onDeleteNote: (id: string) => void
  activeNoteId: string | null
  onNoteClick: (id: string) => void
  onNoteClose: () => void
  selectedNoteIdFromSidebar?: string | null
  onCanvasClick?: () => void
  editingNodeId?: string | null
  onClearCanvas?: () => void
}

export const CanvasArea = ({
  selectedFileId,
  canvasLoading,
  nodes,
  edges,
  selectedNodes,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelectionChange,
  onNodeDoubleClick,
  onEdgeDoubleClick,
  onAddNode,
  isTagPopupOpen,
  selectedTagsForNodes,
  fileTags,
  onTagClick,
  onTagPopupClose,
  onTagToggle,
  onAddTag,
  onRemoveTag,
  colors,
  updateNodeColor,
  updateNodeType,
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  activeNoteId,
  onNoteClick,
  onNoteClose,
  selectedNoteIdFromSidebar,
  onCanvasClick,
  editingNodeId
}: CanvasAreaProps) => {
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null)
  const [viewportUpdated, setViewportUpdated] = useState(0)
  const [isAddNoteMode, setIsAddNoteMode] = useState(false)
  const activeNotePositionRef = useRef<{ x: number; y: number } | null>(null)

  const handleAddNoteClick = useCallback(() => {
    console.log('Add note button clicked, entering note mode')
    setIsAddNoteMode(true)
  }, [])

  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    // Reset note selection when clicking on canvas
    if (onCanvasClick) {
      onCanvasClick()
    }
    
    console.log('Pane clicked!', { isAddNoteMode, hasInstance: !!reactFlowInstanceRef.current })
    
    if (!isAddNoteMode) {
      console.log('Not in add note mode, ignoring click')
      return
    }
    
    if (!reactFlowInstanceRef.current) {
      console.log('React Flow instance not available')
      return
    }
    
    // Prevent default behavior
    event.preventDefault()
    event.stopPropagation()
    
    // Get click position in screen coordinates
    const screenX = event.clientX
    const screenY = event.clientY
    
    console.log('Screen coordinates:', { screenX, screenY })
    
    // Convert screen coordinates to flow coordinates
    // Get the React Flow pane element to calculate relative position
    const pane = document.querySelector('.react-flow__pane') as HTMLElement
    if (!pane) return
    
    const rect = pane.getBoundingClientRect()
    const viewport = reactFlowInstanceRef.current.getViewport()
    
    // Calculate relative position within the pane
    const relativeX = screenX - rect.left
    const relativeY = screenY - rect.top
    
    // Convert to flow coordinates using viewport
    const flowPos = {
      x: (relativeX - viewport.x) / viewport.zoom,
      y: (relativeY - viewport.y) / viewport.zoom
    }
    
    console.log('Adding note at flow coordinates:', flowPos)
    
    onAddNote(flowPos.x, flowPos.y)
    setIsAddNoteMode(false)
  }, [isAddNoteMode, onAddNote, onCanvasClick])


  const handleWrapperClick = useCallback((event: React.MouseEvent) => {
    if (!isAddNoteMode || !reactFlowInstanceRef.current) {
      return
    }

    // Only handle clicks on the wrapper, not on React Flow elements
    if ((event.target as HTMLElement).closest('.react-flow')) {
      return
    }

    console.log('Wrapper clicked in note mode')
    const pane = document.querySelector('.react-flow__pane') as HTMLElement
    if (!pane) return

    const rect = pane.getBoundingClientRect()
    const viewport = reactFlowInstanceRef.current.getViewport()

    const relativeX = event.clientX - rect.left
    const relativeY = event.clientY - rect.top

    const flowPos = {
      x: (relativeX - viewport.x) / viewport.zoom,
      y: (relativeY - viewport.y) / viewport.zoom
    }

    onAddNote(flowPos.x, flowPos.y)
    setIsAddNoteMode(false)
  }, [isAddNoteMode, onAddNote])

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstanceRef.current = instance
    console.log('React Flow initialized')
  }, [])

  const onMove = useCallback(() => {
    // Trigger re-render to update note positions
    setViewportUpdated(prev => prev + 1)
  }, [])

  // Memoize note positions to avoid recalculating on every render
  const notePositions = useMemo(() => {
    if (!reactFlowInstanceRef.current) return []
    
    const viewport = reactFlowInstanceRef.current.getViewport()
    return notes.map((note) => ({
      note,
      position: {
        x: note.x * viewport.zoom + viewport.x,
        y: note.y * viewport.zoom + viewport.y
      }
    }))
  }, [notes, viewportUpdated])

  // Exit note mode on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAddNoteMode) {
        setIsAddNoteMode(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isAddNoteMode])

  // Add direct click handler to pane when in note mode
  useEffect(() => {
    if (!isAddNoteMode) return

    const pane = document.querySelector('.react-flow__pane') as HTMLElement
    if (!pane) return

    console.log('Adding direct click handler to pane')

    const clickHandler = (e: MouseEvent) => {
      if (!reactFlowInstanceRef.current) return

      console.log('Direct pane click handler fired', { clientX: e.clientX, clientY: e.clientY })

      // Get the pane element and viewport
      const pane = document.querySelector('.react-flow__pane') as HTMLElement
      if (!pane) return

      const rect = pane.getBoundingClientRect()
      const viewport = reactFlowInstanceRef.current.getViewport()

      // Calculate relative position within the pane
      const relativeX = e.clientX - rect.left
      const relativeY = e.clientY - rect.top

      // Convert to flow coordinates using viewport
      const flowPos = {
        x: (relativeX - viewport.x) / viewport.zoom,
        y: (relativeY - viewport.y) / viewport.zoom
      }

      console.log('Flow position:', flowPos)
      onAddNote(flowPos.x, flowPos.y)
      setIsAddNoteMode(false)
    }

    pane.addEventListener('click', clickHandler, true) // Use capture phase

    return () => {
      console.log('Removing direct click handler from pane')
      pane.removeEventListener('click', clickHandler, true)
    }
  }, [isAddNoteMode, onAddNote])

  if (!selectedFileId) {
    // No file selected - show empty state with icon-only toolbar
    return (
      <Flex justify="center" align="center" style={{ height: '100%', flexDirection: 'column', gap: '24px' }}>
        <Stack align="center" gap="md">
          <IconFileText size={64} style={{ color: 'var(--text-tertiary)', transition: 'color 0.3s ease' }} />
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
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            transition: 'background-color 0.3s ease, border-color 0.3s ease'
          }}
        >
          <ActionIcon
            size="lg"
            variant="transparent"
            disabled
            title="Idea Node"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <IconSquare size={20} stroke={1.5} />
          </ActionIcon>
          <ActionIcon
            size="lg"
            variant="transparent"
            disabled
            title="Thinking Node"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <IconCircle size={20} stroke={1.5} />
          </ActionIcon>
        </Paper>
      </Flex>
    )
  }

  if (canvasLoading) {
    return (
      <Flex justify="center" align="center" style={{ height: '100%' }}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading canvas...</Text>
        </Stack>
      </Flex>
    )
  }

  return (
    <>
      <Box
        className={isAddNoteMode ? 'add-note-mode' : ''}
        style={{
          width: '100%',
          height: '100%',
          cursor: isAddNoteMode ? 'crosshair' : 'default'
        }}
        onClick={(e) => {
          // Reset note selection when clicking on wrapper (but not on React Flow elements)
          if (!(e.target as HTMLElement).closest('.react-flow')) {
            if (onCanvasClick) onCanvasClick()
          }
          handleWrapperClick(e)
        }}
      >
        <style>
          {`
            .add-note-mode .react-flow__pane {
              cursor: crosshair !important;
            }
            .add-note-mode .react-flow__renderer {
              cursor: crosshair !important;
            }
            .add-note-mode .react-flow__container {
              cursor: crosshair !important;
            }
          `}
        </style>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          onNodeClick={() => {
            if (onCanvasClick) onCanvasClick()
          }}
          onEdgeClick={() => {
            if (onCanvasClick) onCanvasClick()
          }}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onInit={onInit}
          onMove={onMove}
          onMoveStart={onMove}
          onMoveEnd={onMove}
          onPaneClick={(event) => {
            // Clear selection when clicking on pane (unless in note mode)
            if (!isAddNoteMode) {
              // React Flow should handle this, but we'll also manually clear to be sure
              if (onSelectionChange) {
                onSelectionChange({ nodes: [], edges: [] })
              }
            }
            handlePaneClick(event)
          }}
          onMouseDown={(event: React.MouseEvent) => {
            if (isAddNoteMode && reactFlowInstanceRef.current) {
              console.log('Pane mouse down in note mode')
              // Use mouse down to capture the click
              event.preventDefault()
              event.stopPropagation()
            }
          }}
          panOnDrag={!isAddNoteMode && !editingNodeId}
          panOnScroll={!isAddNoteMode}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ 
            markerEnd: { type: MarkerType.ArrowClosed },
            selectable: true,
            deletable: true
          }}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          <Controls />
          <MiniMap />
          <TagPopup
            isOpen={isTagPopupOpen}
            onClose={onTagPopupClose}
            availableTags={fileTags}
            selectedTags={selectedTagsForNodes}
            onTagToggle={onTagToggle}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
          />
          <FloatingColorBar
            selectedNodes={selectedNodes}
            colors={colors}
            updateNodeColor={updateNodeColor}
            updateNodeType={updateNodeType}
            onTagClick={onTagClick}
            isTagPopupOpen={isTagPopupOpen}
          />
        </ReactFlow>
      </Box>

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
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          transition: 'background-color 0.3s ease, border-color 0.3s ease'
        }}
      >
        <ActionIcon
          size="lg"
          variant="transparent"
          onClick={() => onAddNode('rectangle', () => reactFlowInstanceRef.current?.getViewport() || null)}
          title="Add Idea Node"
          style={{ color: 'var(--text-primary)' }}
        >
          <IconSquare size={20} stroke={1.5} />
        </ActionIcon>
        <ActionIcon
          size="lg"
          variant="transparent"
          onClick={() => onAddNode('circle', () => reactFlowInstanceRef.current?.getViewport() || null)}
          title="Add Thinking Node"
          style={{ color: 'var(--text-primary)' }}
        >
          <IconCircle size={20} stroke={1.5} />
        </ActionIcon>
        <ActionIcon
          size="lg"
          variant={isAddNoteMode ? 'filled' : 'transparent'}
          color={isAddNoteMode ? 'blue' : undefined}
          onClick={handleAddNoteClick}
          title={isAddNoteMode ? 'Click on canvas to add note (Press Esc to cancel)' : 'Add Note'}
          style={{
            color: isAddNoteMode ? 'white' : 'var(--text-primary)',
            cursor: isAddNoteMode ? 'crosshair' : 'pointer'
          }}
        >
          <IconMessageCircle size={20} stroke={1.5} />
        </ActionIcon>
      </Paper>

      {/* Note Dots and Popups - positioned in React Flow coordinate space */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        {notePositions.map(({ note, position }) => {
          const isActive = activeNoteId === note.id
          
          // Store position immediately when note becomes active
          if (isActive) {
            activeNotePositionRef.current = position
          }

          return (
            <Box key={note.id} style={{ pointerEvents: 'auto' }}>
              <NoteDot
                x={position.x}
                y={position.y}
                onClick={() => {
                  // Store position immediately before state update
                  activeNotePositionRef.current = position
                  onNoteClick(note.id)
                }}
                isActive={isActive}
                isSelected={selectedNoteIdFromSidebar === note.id}
              />
            </Box>
          )
        })}
        
        {/* Render popup when note is active */}
        {activeNoteId && (() => {
          const activeNote = notes.find(n => n.id === activeNoteId)
          if (!activeNote) return null
          
          // Use cached position if available, otherwise find from memoized positions
          const position = activeNotePositionRef.current || notePositions.find(np => np.note.id === activeNoteId)?.position
          if (!position) return null

          return (
            <Box style={{ pointerEvents: 'auto', zIndex: 1000 }}>
              <NotePopup
                x={position.x}
                y={position.y}
                content={activeNote.content}
                onClose={onNoteClose}
                onSave={(content) => onUpdateNote(activeNote.id, content)}
                onDelete={() => onDeleteNote(activeNote.id)}
              />
            </Box>
          )
        })()}
      </Box>
    </>
  )
}

