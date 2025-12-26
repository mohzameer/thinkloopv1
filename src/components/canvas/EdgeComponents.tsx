import React from 'react'
import { EdgeLabelRenderer, getBezierPath, type EdgeProps, type EdgeTypes } from '@xyflow/react'
import { Textarea } from '@mantine/core'

interface EdgeData {
  label?: string
  isEditing?: boolean
  onLabelChange?: (value: string) => void
  onEditingComplete?: () => void
}

// Custom Edge Component with editable label
export const EditableEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const edgeData = (data as EdgeData) || {}
  
  // Use red color when selected, otherwise use style or default
  const strokeColor = selected 
    ? '#dc2626' // Red color for selected edges
    : ((style as React.CSSProperties)?.stroke as string || '#b1b1b7')
  
  const strokeWidth = selected 
    ? 2 // Slightly thicker when selected
    : ((style as React.CSSProperties)?.strokeWidth as number || 1)

  return (
    <>
      <g>
        <defs>
          <style>
            {`
              @keyframes dash {
                to {
                  stroke-dashoffset: -20;
                }
              }
              .animated-dotted-edge {
                stroke-dasharray: 5 5;
                animation: dash 1s linear infinite;
              }
            `}
          </style>
        </defs>
        {/* Invisible wider path for easier clicking - only when not selected to avoid interference */}
        {!selected && (
          <path
            d={edgePath}
            fill="none"
            stroke="transparent"
            strokeWidth={20}
            style={{ cursor: 'pointer', pointerEvents: 'all' }}
          />
        )}
        {/* Visible edge path */}
        <path
          d={edgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          markerEnd={markerEnd}
          className="animated-dotted-edge"
          style={{ cursor: 'pointer', pointerEvents: selected ? 'all' : 'none' }}
        />
      </g>
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

