import { Box, Flex, Stack, Text, Loader, Paper, ActionIcon } from '@mantine/core'
import { ReactFlow, Background, Controls, MiniMap, BackgroundVariant, type Node, type Edge, type OnNodesChange, type OnEdgesChange, type Connection, type OnSelectionChangeParams } from '@xyflow/react'
import { IconSquare, IconCircle, IconFileText } from '@tabler/icons-react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from './NodeComponents'
import { edgeTypes } from './EdgeComponents'
import { TagPopup } from './TagPopup'
import { FloatingColorBar } from './FloatingColorBar'
import type { Tag } from '../../types/firebase'

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
  onAddNode: (nodeType: 'rectangle' | 'circle') => void
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
  updateNodeColor
}: CanvasAreaProps) => {
  if (!selectedFileId) {
    // No file selected - show empty state with icon-only toolbar
    return (
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
            variant="transparent"
            color="dark"
            disabled
            title="Rectangle"
          >
            <IconSquare size={20} stroke={1.5} />
          </ActionIcon>
          <ActionIcon
            size="lg"
            variant="transparent"
            color="dark"
            disabled
            title="Circle"
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
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
          onTagClick={onTagClick}
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
          variant="transparent"
          color="dark"
          onClick={() => onAddNode('rectangle')}
          title="Add Rectangle"
        >
          <IconSquare size={20} stroke={1.5} />
        </ActionIcon>
        <ActionIcon
          size="lg"
          variant="transparent"
          color="dark"
          onClick={() => onAddNode('circle')}
          title="Add Circle"
        >
          <IconCircle size={20} stroke={1.5} />
        </ActionIcon>
      </Paper>
    </>
  )
}

