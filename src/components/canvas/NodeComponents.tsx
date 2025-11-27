import { Textarea, ActionIcon, Popover, Stack, Button } from '@mantine/core'
import { Handle, Position, type NodeTypes } from '@xyflow/react'
import { IconPlus, IconSquare, IconCircle } from '@tabler/icons-react'
import { useState } from 'react'
import type { Tag } from '../../types/firebase'
import { getTagColor } from './utils'

interface NodeData {
  label: string
  categories?: string[]
  borderColor?: string
  tags?: Tag[]
  isEditing?: boolean
  onLabelChange?: (value: string) => void
  onEditingComplete?: () => void
  onAddConnectedNode?: (nodeId: string, handlePosition: Position, nodeType: string) => void
}

interface NodeProps {
  id: string
  data: NodeData
  selected?: boolean
}

// Plus button component for all connection sides
const HandlePlusButton = ({ 
  nodeId, 
  position, 
  onAddNode 
}: { 
  nodeId: string
  position: Position
  onAddNode?: (nodeId: string, handlePosition: Position, nodeType: string) => void
}) => {
  const [popoverOpened, setPopoverOpened] = useState(false)
  
  // Only show if callback exists
  if (!onAddNode) return null

  const handleAddNodeClick = (nodeType: string) => {
    onAddNode(nodeId, position, nodeType)
    setPopoverOpened(false)
  }

  // Position the button based on handle position
  const buttonStyles: Record<Position, React.CSSProperties> = {
    [Position.Top]: { top: -12, left: '50%', transform: 'translateX(-50%)' },
    [Position.Bottom]: { bottom: -12, left: '50%', transform: 'translateX(-50%)' },
    [Position.Left]: { left: -12, top: '50%', transform: 'translateY(-50%)' },
    [Position.Right]: { right: -12, top: '50%', transform: 'translateY(-50%)' }
  }

  return (
    <div
      style={{
        position: 'absolute',
        ...buttonStyles[position],
        zIndex: 10,
        pointerEvents: 'all'
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Popover
        opened={popoverOpened}
        onChange={setPopoverOpened}
        position={position === Position.Top ? "top" : position === Position.Bottom ? "bottom" : position === Position.Left ? "left" : "right"}
        withArrow
        shadow="md"
      >
        <Popover.Target>
          <ActionIcon
            size="xs"
            radius="xl"
            variant="filled"
            color="blue"
            onClick={() => setPopoverOpened(!popoverOpened)}
          >
            <IconPlus size={10} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap="xs">
            <Button
              size="xs"
              variant="default"
              leftSection={<IconSquare size={16} stroke={1.5} />}
              onClick={() => handleAddNodeClick('rectangle')}
              fullWidth
            >
              Idea Node
            </Button>
            <Button
              size="xs"
              variant="default"
              leftSection={<IconCircle size={16} stroke={1.5} />}
              onClick={() => handleAddNodeClick('circle')}
              fullWidth
            >
              Thinking Node
            </Button>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </div>
  )
}

// Custom Circle Node Component
export const CircleNode = ({ id, data, selected }: NodeProps) => {
  const tags = data.tags || []
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          minWidth: '80px',
          minHeight: '80px',
          width: 'fit-content',
          height: 'fit-content',
          borderRadius: '50%',
          border: `2px solid ${data.borderColor || 'var(--node-border)'}`,
          backgroundColor: 'var(--bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 500,
          textAlign: 'center',
          padding: '16px',
          position: 'relative',
          boxShadow: selected ? '0 0 0 3px rgba(220, 38, 38, 0.3)' : 'none',
          transition: 'all 0.3s ease',
          color: 'var(--text-primary)',
          aspectRatio: '1',
          maxWidth: '300px'
        }}
      >
        <Handle type="target" position={Position.Top} id="top-target" />
        <Handle type="source" position={Position.Top} id="top-source" />
        <Handle type="target" position={Position.Bottom} id="bottom-target" />
        <Handle type="source" position={Position.Bottom} id="bottom-source" />
        <Handle type="target" position={Position.Left} id="left-target" />
        <Handle type="source" position={Position.Left} id="left-source" />
        <Handle type="target" position={Position.Right} id="right-target" />
        <Handle type="source" position={Position.Right} id="right-source" />
        
        {/* Plus buttons for unconnected handles - only show when selected and not editing */}
        {selected && !data.isEditing && (
          <>
            <HandlePlusButton nodeId={id} position={Position.Top} onAddNode={data.onAddConnectedNode} />
            <HandlePlusButton nodeId={id} position={Position.Bottom} onAddNode={data.onAddConnectedNode} />
            <HandlePlusButton nodeId={id} position={Position.Left} onAddNode={data.onAddConnectedNode} />
            <HandlePlusButton nodeId={id} position={Position.Right} onAddNode={data.onAddConnectedNode} />
          </>
        )}
        {data.isEditing ? (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Textarea
              value={data.label}
              onChange={(e) => data.onLabelChange?.(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  data.onEditingComplete?.()
                } else if (e.key === 'Escape') {
                  data.onEditingComplete?.()
                }
              }}
              onBlur={data.onEditingComplete}
              autoFocus
              autosize
              minRows={1}
              maxRows={5}
              styles={{
                input: {
                  fontSize: '12px',
                  fontWeight: 500,
                  textAlign: 'center',
                  padding: '4px',
                  border: 'none',
                  boxShadow: 'none',
                  backgroundColor: 'var(--bg-primary)'
                }
              }}
            />
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {data.label}
          </div>
        )}
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
export const RectangleNode = ({ id, data, selected }: NodeProps) => {
  const tags = data.tags || []
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          padding: '10px 20px',
          borderRadius: '3px',
          border: `2px solid ${data.borderColor || 'var(--node-border)'}`,
          backgroundColor: 'var(--bg-primary)',
          fontSize: '12px',
          fontWeight: 500,
          position: 'relative',
          boxShadow: selected ? '0 0 0 3px rgba(220, 38, 38, 0.3)' : 'none',
          transition: 'all 0.3s ease',
          color: 'var(--text-primary)'
        }}
      >
        <Handle type="target" position={Position.Top} id="top-target" />
        <Handle type="source" position={Position.Top} id="top-source" />
        <Handle type="target" position={Position.Bottom} id="bottom-target" />
        <Handle type="source" position={Position.Bottom} id="bottom-source" />
        <Handle type="target" position={Position.Left} id="left-target" />
        <Handle type="source" position={Position.Left} id="left-source" />
        <Handle type="target" position={Position.Right} id="right-target" />
        <Handle type="source" position={Position.Right} id="right-source" />
        
        {/* Plus buttons for unconnected handles - only show when selected and not editing */}
        {selected && !data.isEditing && (
          <>
            <HandlePlusButton nodeId={id} position={Position.Top} onAddNode={data.onAddConnectedNode} />
            <HandlePlusButton nodeId={id} position={Position.Bottom} onAddNode={data.onAddConnectedNode} />
            <HandlePlusButton nodeId={id} position={Position.Left} onAddNode={data.onAddConnectedNode} />
            <HandlePlusButton nodeId={id} position={Position.Right} onAddNode={data.onAddConnectedNode} />
          </>
        )}
        {data.isEditing ? (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.preventDefault()}
            onMouseMove={(e) => e.stopPropagation()}
            style={{ userSelect: 'text' }}
          >
            <Textarea
              value={data.label}
              onChange={(e) => data.onLabelChange?.(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  data.onEditingComplete?.()
                } else if (e.key === 'Escape') {
                  data.onEditingComplete?.()
                }
              }}
              onBlur={data.onEditingComplete}
              autoFocus
              autosize
              minRows={1}
              maxRows={5}
              styles={{
                input: {
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '4px',
                  border: 'none',
                  boxShadow: 'none',
                  backgroundColor: 'var(--bg-primary)'
                }
              }}
            />
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {data.label}
          </div>
        )}
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

// Custom Diamond Node Component
export const DiamondNode = ({ id, data, selected }: NodeProps) => {
  const tags = data.tags || []
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          position: 'relative',
          width: '100px',
          height: '100px'
        }}
      >
        <div
          style={{
            width: '71px',
            height: '71px',
            transform: 'rotate(45deg)',
            transformOrigin: 'center',
            border: `2px solid ${data.borderColor || 'var(--node-border)'}`,
            backgroundColor: 'var(--bg-primary)',
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginLeft: '-35.5px',
            marginTop: '-35.5px',
            boxShadow: selected ? '0 0 0 3px rgba(220, 38, 38, 0.3)' : 'none',
            transition: 'all 0.3s ease'
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 500,
            textAlign: 'center',
            padding: '8px',
            maxWidth: '60px',
            zIndex: 1,
            color: 'var(--text-primary)',
            transition: 'color 0.3s ease'
          }}
        >
          {data.isEditing ? (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onDragStart={(e) => e.preventDefault()}
              onMouseMove={(e) => e.stopPropagation()}
              style={{ userSelect: 'text' }}
            >
              <Textarea
                value={data.label}
                onChange={(e) => data.onLabelChange?.(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    data.onEditingComplete?.()
                  } else if (e.key === 'Escape') {
                    data.onEditingComplete?.()
                  }
                }}
                onBlur={data.onEditingComplete}
                autoFocus
                autosize
                minRows={1}
                maxRows={3}
                styles={{
                  input: {
                    fontSize: '12px',
                    fontWeight: 500,
                    textAlign: 'center',
                    padding: '4px',
                    border: 'none',
                    boxShadow: 'none',
                    backgroundColor: 'var(--bg-primary)'
                  }
                }}
              />
            </div>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {data.label}
            </div>
          )}
        </div>
        <Handle type="target" position={Position.Top} id="top-target" />
        <Handle type="source" position={Position.Top} id="top-source" />
        <Handle type="target" position={Position.Bottom} id="bottom-target" />
        <Handle type="source" position={Position.Bottom} id="bottom-source" />
        <Handle type="target" position={Position.Left} id="left-target" />
        <Handle type="source" position={Position.Left} id="left-source" />
        <Handle type="target" position={Position.Right} id="right-target" />
        <Handle type="source" position={Position.Right} id="right-source" />
        
        {/* Plus buttons for unconnected handles - only show when selected and not editing */}
        {selected && !data.isEditing && (
          <>
            <HandlePlusButton nodeId={id} position={Position.Top} onAddNode={data.onAddConnectedNode} />
            <HandlePlusButton nodeId={id} position={Position.Bottom} onAddNode={data.onAddConnectedNode} />
            <HandlePlusButton nodeId={id} position={Position.Left} onAddNode={data.onAddConnectedNode} />
            <HandlePlusButton nodeId={id} position={Position.Right} onAddNode={data.onAddConnectedNode} />
          </>
        )}
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

// Custom Triangle Node Component
export const TriangleNode = ({ id, data, selected }: NodeProps) => {
  const tags = data.tags || []
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          position: 'relative',
          width: '100px',
          height: '100px'
        }}
      >
        <svg
          width="100"
          height="100"
          style={{
            position: 'absolute',
            top: 0,
            left: 0
          }}
        >
          <polygon
            points="50,10 90,85 10,85"
            fill="var(--bg-primary)"
            stroke={data.borderColor || 'var(--node-border)'}
            strokeWidth="2"
            style={{
              filter: selected ? 'drop-shadow(0 0 3px rgba(220, 38, 38, 0.3))' : 'none',
              transition: 'all 0.3s ease'
            }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -30%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 500,
            textAlign: 'center',
            padding: '8px',
            maxWidth: '60px',
            zIndex: 1,
            color: 'var(--text-primary)',
            transition: 'color 0.3s ease'
          }}
        >
          {data.isEditing ? (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onDragStart={(e) => e.preventDefault()}
              onMouseMove={(e) => e.stopPropagation()}
              style={{ userSelect: 'text' }}
            >
              <Textarea
                value={data.label}
                onChange={(e) => data.onLabelChange?.(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    data.onEditingComplete?.()
                  } else if (e.key === 'Escape') {
                    data.onEditingComplete?.()
                  }
                }}
                onBlur={data.onEditingComplete}
                autoFocus
                autosize
                minRows={1}
                maxRows={3}
                styles={{
                  input: {
                    fontSize: '12px',
                    fontWeight: 500,
                    textAlign: 'center',
                    padding: '4px',
                    border: 'none',
                    boxShadow: 'none',
                    backgroundColor: 'var(--bg-primary)'
                  }
                }}
              />
            </div>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {data.label}
            </div>
          )}
        </div>
        <Handle type="target" position={Position.Top} id="top-target" />
        <Handle type="source" position={Position.Top} id="top-source" />
        <Handle type="target" position={Position.Bottom} id="bottom-target" />
        <Handle type="source" position={Position.Bottom} id="bottom-source" />
        <Handle type="target" position={Position.Left} id="left-target" />
        <Handle type="source" position={Position.Left} id="left-source" />
        <Handle type="target" position={Position.Right} id="right-target" />
        <Handle type="source" position={Position.Right} id="right-source" />
        
        {/* Plus buttons for unconnected handles - only show when selected and not editing */}
        {selected && !data.isEditing && (
          <>
            <HandlePlusButton nodeId={id} position={Position.Top} onAddNode={data.onAddConnectedNode} />
            <HandlePlusButton nodeId={id} position={Position.Bottom} onAddNode={data.onAddConnectedNode} />
            <HandlePlusButton nodeId={id} position={Position.Left} onAddNode={data.onAddConnectedNode} />
            <HandlePlusButton nodeId={id} position={Position.Right} onAddNode={data.onAddConnectedNode} />
          </>
        )}
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
export const nodeTypes: NodeTypes = {
  circle: CircleNode,
  rectangle: RectangleNode,
  diamond: DiamondNode,
  triangle: TriangleNode
}

