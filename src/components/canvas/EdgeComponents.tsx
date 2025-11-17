import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps, type EdgeTypes } from '@xyflow/react'
import { Textarea } from '@mantine/core'

interface EdgeData {
  label?: string
  isEditing?: boolean
  onLabelChange?: (value: string) => void
  onEditingComplete?: () => void
}

// Custom Edge Component with editable label
export const EditableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data
}: EdgeProps<EdgeData>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const edgeData = data || {}

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={style}
      />
      <EdgeLabelRenderer>
        {/* Label or text input */}
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 9,
            fontWeight: 400,
            pointerEvents: 'all',
            zIndex: 10
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {edgeData.isEditing ? (
            <Textarea
              value={edgeData.label || ''}
              onChange={(e) => edgeData.onLabelChange?.(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  edgeData.onEditingComplete?.()
                } else if (e.key === 'Escape') {
                  edgeData.onEditingComplete?.()
                }
              }}
              onBlur={edgeData.onEditingComplete}
              autoFocus
              autosize
              minRows={1}
              maxRows={3}
              styles={{
                input: {
                  fontSize: '9px',
                  fontWeight: 400,
                  padding: '2px 4px',
                  border: 'none',
                  boxShadow: 'none',
                  backgroundColor: 'white',
                  color: '#000',
                  minWidth: '40px'
                }
              }}
            />
          ) : edgeData.label ? (
            <div
              style={{
                backgroundColor: 'white',
                padding: '2px 4px',
                color: '#000',
                whiteSpace: 'pre-wrap',
                maxWidth: '150px',
                wordBreak: 'break-word'
              }}
            >
              {edgeData.label}
            </div>
          ) : null}
        </div>

      </EdgeLabelRenderer>
    </>
  )
}

// Define edge types
export const edgeTypes: EdgeTypes = {
  default: EditableEdge,
}

