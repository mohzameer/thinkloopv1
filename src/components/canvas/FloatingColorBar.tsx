import { Paper, Tooltip, ActionIcon } from '@mantine/core'
import { IconTag, IconSquare, IconCircle } from '@tabler/icons-react'
import type { Node } from '@xyflow/react'

interface ColorBarProps {
  selectedNodes: Node[]
  colors: { name: string; value: string }[]
  updateNodeColor: (color: string) => void
  updateNodeType: (nodeType: 'rectangle' | 'circle') => void
  onTagClick: () => void
  isTagPopupOpen: boolean
}

export const FloatingColorBar = ({ 
  selectedNodes, 
  colors, 
  updateNodeColor,
  updateNodeType,
  onTagClick, 
  isTagPopupOpen 
}: ColorBarProps) => {
  if (selectedNodes.length === 0) return null

  // Check if all selected nodes have the same type
  // Filter to only rectangle and circle types, default to 'rectangle' if type is undefined or not rectangle/circle
  const selectedNodeTypes = selectedNodes.map(node => {
    const nodeType = node.type || 'rectangle'
    // Only consider rectangle and circle types for the toolbar
    return (nodeType === 'rectangle' || nodeType === 'circle') ? nodeType : 'rectangle'
  })
  const allSameType = selectedNodeTypes.length > 0 && selectedNodeTypes.every(type => type === selectedNodeTypes[0])
  const currentType = allSameType ? (selectedNodeTypes[0] as 'rectangle' | 'circle') : null

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
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '8px',
          transition: 'background-color 0.3s ease'
        }}
      >
        {colors.map((color) => (
          <Tooltip key={color.value} label={color.name} position="top" withArrow>
            <ActionIcon
              size="lg"
              variant="light"
              onClick={() => updateNodeColor(color.value)}
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: `2px solid ${color.value}`,
                borderRadius: '4px',
                transition: 'background-color 0.3s ease'
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
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', marginLeft: '4px', transition: 'background-color 0.3s ease' }} />

        {/* Node type buttons */}
        <Tooltip label="Idea Node (Rectangle)" position="top" withArrow>
          <ActionIcon
            size="lg"
            variant={currentType === 'rectangle' ? 'filled' : 'light'}
            onClick={() => updateNodeType('rectangle')}
            title="Change to Idea Node"
            style={{
              backgroundColor: currentType === 'rectangle' ? '#339af0' : 'var(--bg-primary)',
              color: currentType === 'rectangle' ? 'white' : 'var(--text-primary)',
              border: currentType === 'rectangle' ? '2px solid #339af0' : '1px solid var(--border-color)',
              transition: 'all 0.2s ease'
            }}
          >
            <IconSquare size={20} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Thinking Node (Circle)" position="top" withArrow>
          <ActionIcon
            size="lg"
            variant={currentType === 'circle' ? 'filled' : 'light'}
            onClick={() => updateNodeType('circle')}
            title="Change to Thinking Node"
            style={{
              backgroundColor: currentType === 'circle' ? '#339af0' : 'var(--bg-primary)',
              color: currentType === 'circle' ? 'white' : 'var(--text-primary)',
              border: currentType === 'circle' ? '2px solid #339af0' : '1px solid var(--border-color)',
              transition: 'all 0.2s ease'
            }}
          >
            <IconCircle size={20} stroke={1.5} />
          </ActionIcon>
        </Tooltip>

        {/* Divider with spacing */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', marginLeft: '4px', transition: 'background-color 0.3s ease' }} />

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
            <IconTag size={20} />
          </ActionIcon>
        </Tooltip>
      </Paper>
    </div>
  )
}

