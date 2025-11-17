import { Textarea, ActionIcon, Popover, Stack, Button } from '@mantine/core'
import { Handle, Position, type NodeTypes, useEdges, useNodes } from '@xyflow/react'
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

// Plus button component for unconnected handles
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
  const edges = useEdges()
  const nodes = useNodes()
  
  // Check if this handle position is connected
  const positionLower = position.toLowerCase()
  
  // Check if this node has ANY edges without handle specifications
  // For these old manually-created edges, we can't reliably detect which sides are connected
  // because React Flow's automatic routing doesn't match our position-based inference
  const hasEdgeWithoutHandles = edges.some(edge => {
    if (edge.source === nodeId && !edge.sourceHandle) return true
    if (edge.target === nodeId && !edge.targetHandle) return true
    return false
  })
  
  // If there are edges without handles, hide ALL plus buttons on this node (safest approach)
  if (hasEdgeWithoutHandles) return null
  
  // Get current node position
  const currentNode = nodes.find(n => n.id === nodeId)
  
  // Helper to infer handle position based on node positions (for old edges without handles)
  const inferHandlePosition = (sourceId: string, targetId: string, isSource: boolean): Position => {
    const sourceNode = nodes.find(n => n.id === sourceId)
    const targetNode = nodes.find(n => n.id === targetId)
    if (!sourceNode || !targetNode) return Position.Right
    
    const dx = targetNode.position.x - sourceNode.position.x
    const dy = targetNode.position.y - sourceNode.position.y
    
    // Determine which side based on relative position
    let position: Position
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal connection
      position = dx > 0 ? Position.Right : Position.Left
    } else {
      // Vertical connection
      position = dy > 0 ? Position.Bottom : Position.Top
    }
    
    // If this is the target node, return the opposite side
    if (!isSource) {
      const opposites: Record<Position, Position> = {
        [Position.Top]: Position.Bottom,
        [Position.Bottom]: Position.Top,
        [Position.Left]: Position.Right,
        [Position.Right]: Position.Left
      }
      position = opposites[position]
    }
    
    return position
  }
  
  // Get all edges connected to this node at this position
  const connectedEdges = edges.filter(edge => {
    // Check if this node is the source
    if (edge.source === nodeId) {
      // If sourceHandle is specified, check if it matches
      if (edge.sourceHandle) {
        if (edge.sourceHandle.includes(positionLower)) {
          return true
        }
      } else {
        // No handle specified - infer from positions
        const inferredPosition = inferHandlePosition(edge.source, edge.target, true)
        if (inferredPosition === position) {
          return true
        }
      }
    }
    
    // Check if this node is the target
    if (edge.target === nodeId) {
      // If targetHandle is specified, check if it matches
      if (edge.targetHandle) {
        if (edge.targetHandle.includes(positionLower)) {
          return true
        }
      } else {
        // No handle specified - infer from positions
        const inferredPosition = inferHandlePosition(edge.source, edge.target, false)
        if (inferredPosition === position) {
          return true
        }
      }
    }
    
    return false
  })
  
  const isConnected = connectedEdges.length > 0
  
  // Only show if not connected and callback exists
  if (isConnected || !onAddNode) return null

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
              Rectangle
            </Button>
            <Button
              size="xs"
              variant="default"
              leftSection={<IconCircle size={16} stroke={1.5} />}
              onClick={() => handleAddNodeClick('circle')}
              fullWidth
            >
              Circle
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
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          border: `2px solid ${data.borderColor || 'var(--node-border)'}`,
          backgroundColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 500,
          textAlign: 'center',
          padding: '8px',
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
        
        {/* Plus buttons for unconnected handles - only show when selected */}
        {selected && (
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
                  backgroundColor: 'transparent'
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
          backgroundColor: 'transparent',
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
        
        {/* Plus buttons for unconnected handles - only show when selected */}
        {selected && (
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
                  padding: '4px',
                  border: 'none',
                  boxShadow: 'none',
                  backgroundColor: 'transparent'
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
            backgroundColor: 'transparent',
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
                    backgroundColor: 'transparent'
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
        
        {/* Plus buttons for unconnected handles - only show when selected */}
        {selected && (
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
            fill="transparent"
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
                    backgroundColor: 'transparent'
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
        
        {/* Plus buttons for unconnected handles - only show when selected */}
        {selected && (
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

