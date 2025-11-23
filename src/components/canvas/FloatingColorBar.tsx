import { Paper, Tooltip, ActionIcon } from '@mantine/core'
import { IconTag } from '@tabler/icons-react'
import type { Node } from '@xyflow/react'

interface ColorBarProps {
  selectedNodes: Node[]
  colors: { name: string; value: string }[]
  updateNodeColor: (color: string) => void
  onTagClick: () => void
  isTagPopupOpen: boolean
}

export const FloatingColorBar = ({ 
  selectedNodes, 
  colors, 
  updateNodeColor, 
  onTagClick, 
  isTagPopupOpen 
}: ColorBarProps) => {
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

