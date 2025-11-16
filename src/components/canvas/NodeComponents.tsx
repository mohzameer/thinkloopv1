import { Textarea } from '@mantine/core'
import { Handle, Position, type NodeTypes } from '@xyflow/react'
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
}

interface NodeProps {
  data: NodeData
  selected?: boolean
}

// Custom Circle Node Component
export const CircleNode = ({ data, selected }: NodeProps) => {
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
        <Handle type="target" position={Position.Top} id="top-target" />
        <Handle type="source" position={Position.Top} id="top-source" />
        <Handle type="target" position={Position.Bottom} id="bottom-target" />
        <Handle type="source" position={Position.Bottom} id="bottom-source" />
        <Handle type="target" position={Position.Left} id="left-target" />
        <Handle type="source" position={Position.Left} id="left-source" />
        <Handle type="target" position={Position.Right} id="right-target" />
        <Handle type="source" position={Position.Right} id="right-source" />
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
export const RectangleNode = ({ data, selected }: NodeProps) => {
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
        <Handle type="target" position={Position.Top} id="top-target" />
        <Handle type="source" position={Position.Top} id="top-source" />
        <Handle type="target" position={Position.Bottom} id="bottom-target" />
        <Handle type="source" position={Position.Bottom} id="bottom-source" />
        <Handle type="target" position={Position.Left} id="left-target" />
        <Handle type="source" position={Position.Left} id="left-source" />
        <Handle type="target" position={Position.Right} id="right-target" />
        <Handle type="source" position={Position.Right} id="right-source" />
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

// Define node types
export const nodeTypes: NodeTypes = {
  circle: CircleNode,
  rectangle: RectangleNode
}

