/**
 * Node/Edge Generator
 * 
 * Converts AI response data (NodeData, EdgeData) into React Flow nodes and edges
 * Handles position calculation, node reference resolution, and ID generation
 */

import type { Node, Edge } from '@xyflow/react'
import { MarkerType } from '@xyflow/react'
import type { NodeData, EdgeData, NodeType } from './responseParser'

export interface GenerateOptions {
  existingNodes: Node[]
  existingEdges: Edge[]
  nodeIdCounter: number
  defaultOffset?: number
  canvasBounds?: {
    minX?: number
    maxX?: number
    minY?: number
    maxY?: number
  }
}

export interface GenerateResult {
  nodes: Node[]
  edges: Edge[]
  nextNodeIdCounter: number
  errors: string[]
  warnings: string[]
}

/**
 * Create a label-to-ID mapping from existing nodes
 */
function createLabelToIdMap(nodes: Node[]): Map<string, string> {
  const map = new Map<string, string>()
  nodes.forEach(node => {
    const label = (node.data as any)?.label
    if (label && typeof label === 'string') {
      // Use first match (if multiple nodes have same label, use first one)
      if (!map.has(label)) {
        map.set(label.toLowerCase(), node.id)
      }
    }
  })
  return map
}

/**
 * Resolve node reference (ID or label) to actual node ID
 */
function resolveNodeReference(
  reference: string,
  existingNodes: Node[],
  labelToIdMap: Map<string, string>,
  newNodeIdMap: Map<string, string>
): string | null {
  // Check if it's already an ID in existing nodes
  if (existingNodes.some(n => n.id === reference)) {
    return reference
  }

  // Check if it's an ID in new nodes
  if (newNodeIdMap.has(reference)) {
    return newNodeIdMap.get(reference)!
  }

  // Check label mapping (case-insensitive)
  const labelKey = reference.toLowerCase()
  if (labelToIdMap.has(labelKey)) {
    return labelToIdMap.get(labelKey)!
  }

  // Check new node labels (iterate by checking values)
  // Note: newNodeIdMap maps id -> label, so we need to find by value
  const entries = Array.from(newNodeIdMap.entries())
  for (let i = 0; i < entries.length; i++) {
    const [newId, newLabel] = entries[i]
    if (newLabel && newLabel.toLowerCase() === labelKey) {
      return newId
    }
  }

  return null
}

/**
 * Detect positioning keywords in offset values
 */
function detectPositioningKeyword(offset: { x: number; y: number }): 'right' | 'left' | 'above' | 'below' | 'between' | null {
  // Check for "next to" / "right" positioning (positive X, small Y)
  if (offset.x > 100 && Math.abs(offset.y) < 50) {
    return 'right'
  }
  // Check for "left" positioning (negative X, small Y)
  if (offset.x < -100 && Math.abs(offset.y) < 50) {
    return 'left'
  }
  // Check for "below" positioning (positive Y, small X)
  if (offset.y > 100 && Math.abs(offset.x) < 50) {
    return 'below'
  }
  // Check for "above" positioning (negative Y, small X)
  if (offset.y < -100 && Math.abs(offset.x) < 50) {
    return 'above'
  }
  return null
}

/**
 * Calculate position for a node (enhanced with smart positioning)
 */
function calculatePosition(
  nodeData: NodeData,
  existingNodes: Node[],
  newNodes: Node[],
  labelToIdMap: Map<string, string>,
  newNodeIdMap: Map<string, string>,
  defaultOffset: number = 150,
  canvasBounds?: { minX?: number; maxX?: number; minY?: number; maxY?: number }
): { x: number; y: number } {
  // Absolute position provided
  if (nodeData.position) {
    let position = nodeData.position
    if (canvasBounds) {
      position = clampToCanvasBounds(position, canvasBounds)
    }
    return position
  }

  // Relative position provided
  if (nodeData.positionRelative) {
    const refId = resolveNodeReference(
      nodeData.positionRelative.relativeTo,
      existingNodes,
      labelToIdMap,
      newNodeIdMap
    )

    if (refId) {
      // Find the reference node (could be existing or new)
      let refNode: Node | null = existingNodes.find(n => n.id === refId) || null
      
      if (!refNode) {
        refNode = newNodes.find(n => n.id === refId) || null
      }

      if (refNode) {
        // Check for positioning keywords
        const keyword = detectPositioningKeyword(nodeData.positionRelative.offset)
        
        if (keyword && keyword !== 'between') {
          // Use smart positioning for "next to", "below", etc.
          let position = calculateNextToPosition(refNode, keyword)
          if (canvasBounds) {
            position = clampToCanvasBounds(position, canvasBounds)
          }
          return position
        } else {
          // Use explicit offset
          let position = {
            x: refNode.position.x + nodeData.positionRelative.offset.x,
            y: refNode.position.y + nodeData.positionRelative.offset.y
          }
          if (canvasBounds) {
            position = clampToCanvasBounds(position, canvasBounds)
          }
          return position
        }
      }
    }
  }

  // Smart default: position near center or existing nodes
  const allNodes = [...existingNodes, ...newNodes]
  if (allNodes.length > 0) {
    // Find average position of all nodes
    const avgX = allNodes.reduce((sum, n) => sum + n.position.x, 0) / allNodes.length
    const avgY = allNodes.reduce((sum, n) => sum + n.position.y, 0) / allNodes.length

    // Use better spacing (avoid random, use consistent offset)
    const offsetX = defaultOffset
    const offsetY = 0

    let position = {
      x: avgX + offsetX,
      y: avgY + offsetY
    }
    
    if (canvasBounds) {
      position = clampToCanvasBounds(position, canvasBounds)
    }
    
    return position
  }

  // Fallback: center of visible area
  let position = {
    x: 400,
    y: 300
  }
  
  if (canvasBounds) {
    const { minX = 0, maxX = 800, minY = 0, maxY = 600 } = canvasBounds
    position = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    }
  }
  
  return position
}

// Estimated node dimensions (conservative estimate)
const NODE_WIDTH = 150
const NODE_HEIGHT = 80
const NODE_PADDING = 20 // Extra padding between nodes

/**
 * Estimate node bounding box
 */
function getNodeBounds(node: Node): { x: number; y: number; width: number; height: number } {
  const label = (node.data as any)?.label || ''
  // Estimate width based on label length (rough approximation)
  const estimatedWidth = Math.max(NODE_WIDTH, label.length * 8 + 40)
  return {
    x: node.position.x,
    y: node.position.y,
    width: estimatedWidth,
    height: NODE_HEIGHT
  }
}

/**
 * Check if two bounding boxes overlap
 */
function boxesOverlap(
  box1: { x: number; y: number; width: number; height: number },
  box2: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    box1.x + box1.width + NODE_PADDING < box2.x ||
    box2.x + box2.width + NODE_PADDING < box1.x ||
    box1.y + box1.height + NODE_PADDING < box2.y ||
    box2.y + box2.height + NODE_PADDING < box1.y
  )
}

/**
 * Check if position conflicts with existing nodes (using bounding boxes)
 */
function hasPositionConflict(
  position: { x: number; y: number },
  existingNodes: Node[],
  newNodes: Node[],
  nodeLabel?: string
): boolean {
  const allNodes = [...existingNodes, ...newNodes]
  const label = nodeLabel || ''
  const estimatedWidth = Math.max(NODE_WIDTH, label.length * 8 + 40)
  const newBox = {
    x: position.x,
    y: position.y,
    width: estimatedWidth,
    height: NODE_HEIGHT
  }
  
  return allNodes.some(node => {
    const nodeBox = getNodeBounds(node)
    return boxesOverlap(newBox, nodeBox)
  })
}

/**
 * Check if position is within canvas bounds
 */
function isWithinCanvasBounds(
  position: { x: number; y: number },
  bounds?: { minX?: number; maxX?: number; minY?: number; maxY?: number }
): boolean {
  if (!bounds) return true
  
  const { minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity } = bounds
  return position.x >= minX && position.x <= maxX && position.y >= minY && position.y <= maxY
}

/**
 * Clamp position to canvas bounds
 */
function clampToCanvasBounds(
  position: { x: number; y: number },
  bounds?: { minX?: number; maxX?: number; minY?: number; maxY?: number }
): { x: number; y: number } {
  if (!bounds) return position
  
  const { minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity } = bounds
  return {
    x: Math.max(minX, Math.min(maxX, position.x)),
    y: Math.max(minY, Math.min(maxY, position.y))
  }
}

/**
 * Adjust position to avoid conflicts (enhanced with better spacing)
 */
function adjustPositionForConflict(
  position: { x: number; y: number },
  existingNodes: Node[],
  newNodes: Node[],
  nodeLabel?: string,
  maxAttempts: number = 20,
  canvasBounds?: { minX?: number; maxX?: number; minY?: number; maxY?: number }
): { x: number; y: number } {
  let adjusted = { ...position }
  let attempts = 0

  // First, try to find a nearby free space
  while (hasPositionConflict(adjusted, existingNodes, newNodes, nodeLabel) && attempts < maxAttempts) {
    // Try different offsets in a spiral pattern
    const angle = (attempts * 30) * (Math.PI / 180) // 30-degree increments
    const distance = NODE_WIDTH + NODE_PADDING + (attempts * 10) // Increase distance with attempts
    
    adjusted = {
      x: position.x + Math.cos(angle) * distance,
      y: position.y + Math.sin(angle) * distance
    }
    
    // Clamp to canvas bounds if provided
    if (canvasBounds) {
      adjusted = clampToCanvasBounds(adjusted, canvasBounds)
    }
    
    attempts++
  }

  // If still conflicting, try finding the nearest free space
  if (hasPositionConflict(adjusted, existingNodes, newNodes, nodeLabel) && attempts >= maxAttempts) {
    // Find the rightmost/bottommost node and place to the right/below
    const allNodes = [...existingNodes, ...newNodes]
    if (allNodes.length > 0) {
      const rightmostNode = allNodes.reduce((max, node) => 
        node.position.x > max.position.x ? node : max
      )
      const rightmostBox = getNodeBounds(rightmostNode)
      adjusted = {
        x: rightmostBox.x + rightmostBox.width + NODE_PADDING,
        y: rightmostBox.y
      }
      
      if (canvasBounds) {
        adjusted = clampToCanvasBounds(adjusted, canvasBounds)
      }
    }
  }

  return adjusted
}

/**
 * Calculate grid position for multiple nodes
 */
function calculateGridPosition(
  index: number,
  totalNodes: number,
  startPosition: { x: number; y: number },
  columns: number = 3
): { x: number; y: number } {
  const row = Math.floor(index / columns)
  const col = index % columns
  const spacingX = NODE_WIDTH + NODE_PADDING
  const spacingY = NODE_HEIGHT + NODE_PADDING
  
  return {
    x: startPosition.x + col * spacingX,
    y: startPosition.y + row * spacingY
  }
}

/**
 * Calculate position between two nodes
 */
function calculateBetweenPosition(
  node1: Node,
  node2: Node
): { x: number; y: number } {
  const box1 = getNodeBounds(node1)
  const box2 = getNodeBounds(node2)
  
  // Calculate midpoint
  const midX = (box1.x + box1.width + box2.x) / 2
  const midY = (box1.y + box1.height + box2.y) / 2
  
  return {
    x: midX - NODE_WIDTH / 2,
    y: midY - NODE_HEIGHT / 2
  }
}

/**
 * Calculate "next to" position (right side by default)
 */
function calculateNextToPosition(
  refNode: Node,
  direction: 'right' | 'left' | 'above' | 'below' = 'right'
): { x: number; y: number } {
  const refBox = getNodeBounds(refNode)
  const spacing = NODE_WIDTH + NODE_PADDING
  
  switch (direction) {
    case 'right':
      return {
        x: refBox.x + refBox.width + NODE_PADDING,
        y: refBox.y
      }
    case 'left':
      return {
        x: refBox.x - NODE_WIDTH - NODE_PADDING,
        y: refBox.y
      }
    case 'below':
      return {
        x: refBox.x,
        y: refBox.y + refBox.height + NODE_PADDING
      }
    case 'above':
      return {
        x: refBox.x,
        y: refBox.y - NODE_HEIGHT - NODE_PADDING
      }
  }
}

/**
 * Generate React Flow nodes from NodeData array
 */
export function generateNodes(
  nodeDataArray: NodeData[],
  options: GenerateOptions
): {
  nodes: Node[]
  nextNodeIdCounter: number
  errors: string[]
  warnings: string[]
  labelToIdMap: Map<string, string>
} {
  const {
    existingNodes,
    nodeIdCounter,
    defaultOffset = 150
  } = options

  const nodes: Node[] = []
  const errors: string[] = []
  const warnings: string[] = []
  let currentIdCounter = nodeIdCounter

  // Create label-to-ID mapping for existing nodes
  const labelToIdMap = createLabelToIdMap(existingNodes)

  // Create mapping for new nodes (label -> id)
  const newNodeIdMap = new Map<string, string>()

  // Detect if we should use grid layout (multiple nodes without explicit positions)
  const nodesWithoutPosition = nodeDataArray.filter(
    nd => !nd.position && !nd.positionRelative
  )
  const shouldUseGrid = nodesWithoutPosition.length >= 3 && nodeDataArray.length >= 3
  let gridStartPosition: { x: number; y: number } | null = null
  
  if (shouldUseGrid && existingNodes.length > 0) {
    // Find a good starting position for grid (right of existing nodes)
    const rightmostNode = existingNodes.reduce((max, node) => 
      node.position.x > max.position.x ? node : max
    )
    const rightmostBox = getNodeBounds(rightmostNode)
    gridStartPosition = {
      x: rightmostBox.x + rightmostBox.width + NODE_PADDING * 2,
      y: rightmostBox.y
    }
  } else if (shouldUseGrid) {
    // No existing nodes, start at center
    gridStartPosition = { x: 400, y: 300 }
  }

  // First pass: create all nodes
  let gridIndex = 0
  for (const nodeData of nodeDataArray) {
    if (!nodeData.label || nodeData.label.trim().length === 0) {
      errors.push('Node missing label, skipping')
      continue
    }

    // Generate unique ID
    const nodeId = `${currentIdCounter}`
    currentIdCounter++

    // Calculate position (pass nodes created so far for relative positioning)
    let position: { x: number; y: number }
    
    // Use grid layout if appropriate
    if (shouldUseGrid && !nodeData.position && !nodeData.positionRelative && gridStartPosition) {
      position = calculateGridPosition(
        gridIndex,
        nodesWithoutPosition.length,
        gridStartPosition,
        Math.ceil(Math.sqrt(nodesWithoutPosition.length))
      )
      gridIndex++
    } else {
      position = calculatePosition(
        nodeData,
        existingNodes,
        nodes,
        labelToIdMap,
        newNodeIdMap,
        defaultOffset,
        options.canvasBounds
      )
    }

    // Check for position conflicts and adjust if needed
    if (hasPositionConflict(position, existingNodes, nodes, nodeData.label)) {
      position = adjustPositionForConflict(
        position,
        existingNodes,
        nodes,
        nodeData.label,
        20,
        options.canvasBounds
      )
      warnings.push(`Adjusted position for node "${nodeData.label}" to avoid overlap`)
    }
    
    // Ensure position is within canvas bounds
    if (options.canvasBounds && !isWithinCanvasBounds(position, options.canvasBounds)) {
      position = clampToCanvasBounds(position, options.canvasBounds)
      warnings.push(`Clamped position for node "${nodeData.label}" to canvas bounds`)
    }

    // Create node
    const node: Node = {
      id: nodeId,
      type: nodeData.type || 'rectangle',
      data: {
        label: nodeData.label.trim(),
        ...(nodeData.tags && nodeData.tags.length > 0 && { categories: nodeData.tags })
      },
      position
    }

    nodes.push(node)
    newNodeIdMap.set(nodeId, nodeData.label.trim().toLowerCase())
  }

  return {
    nodes,
    nextNodeIdCounter: currentIdCounter,
    errors,
    warnings,
    labelToIdMap
  }
}

/**
 * Generate React Flow edges from EdgeData array
 */
export function generateEdges(
  edgeDataArray: EdgeData[],
  existingNodes: Node[],
  newNodes: Node[],
  existingEdges: Edge[],
  labelToIdMap: Map<string, string>,
  newNodeIdMap: Map<string, string>
): {
  edges: Edge[]
  errors: string[]
  warnings: string[]
} {
  const edges: Edge[] = []
  const errors: string[] = []
  const warnings: string[] = []
  const allNodes = [...existingNodes, ...newNodes]

  // Track created edges to avoid duplicates
  const edgeSet = new Set<string>()

  for (const edgeData of edgeDataArray) {
    if (!edgeData.source || !edgeData.target) {
      errors.push('Edge missing source or target, skipping')
      continue
    }

    // Resolve source and target references
    const sourceId = resolveNodeReference(
      edgeData.source,
      existingNodes,
      labelToIdMap,
      newNodeIdMap
    )

    const targetId = resolveNodeReference(
      edgeData.target,
      existingNodes,
      labelToIdMap,
      newNodeIdMap
    )

    if (!sourceId) {
      errors.push(`Cannot resolve source node: "${edgeData.source}"`)
      continue
    }

    if (!targetId) {
      errors.push(`Cannot resolve target node: "${edgeData.target}"`)
      continue
    }

    if (sourceId === targetId) {
      warnings.push(`Skipping self-referencing edge from "${edgeData.source}"`)
      continue
    }

    // Check for duplicate edges
    const edgeKey = `${sourceId}-${targetId}`
    if (edgeSet.has(edgeKey)) {
      warnings.push(`Duplicate edge from "${edgeData.source}" to "${edgeData.target}", skipping`)
      continue
    }

    // Check if edge already exists
    const existingEdge = existingEdges.find(
      e => e.source === sourceId && e.target === targetId
    )
    if (existingEdge) {
      warnings.push(`Edge from "${edgeData.source}" to "${edgeData.target}" already exists, skipping`)
      continue
    }

    edgeSet.add(edgeKey)

    // Create edge
    const edge: Edge = {
      id: `e${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      sourceHandle: 'right-source', // Default handle
      targetHandle: 'left-target',   // Default handle
      markerEnd: { type: MarkerType.ArrowClosed },
      ...(edgeData.label && {
        data: {
          label: edgeData.label.trim()
        }
      })
    }

    edges.push(edge)
  }

  return {
    edges,
    errors,
    warnings
  }
}

/**
 * Generate nodes and edges from AI response data
 */
export function generateNodesAndEdges(
  nodeDataArray: NodeData[],
  edgeDataArray: EdgeData[],
  options: GenerateOptions
): GenerateResult {
  // Validate inputs
  if (!nodeDataArray || !Array.isArray(nodeDataArray)) {
    return {
      nodes: [],
      edges: [],
      nextNodeIdCounter: options.nodeIdCounter,
      errors: ['Invalid node data: expected array'],
      warnings: []
    }
  }

  if (!edgeDataArray || !Array.isArray(edgeDataArray)) {
    return {
      nodes: [],
      edges: [],
      nextNodeIdCounter: options.nodeIdCounter,
      errors: ['Invalid edge data: expected array'],
      warnings: []
    }
  }

  // Generate nodes first
  const nodeResult = generateNodes(nodeDataArray, options)

  // Create newNodeIdMap for edge generation
  const newNodeIdMap = new Map<string, string>()
  nodeResult.nodes.forEach(node => {
    const label = ((node.data as any)?.label || '').toLowerCase()
    if (label) {
      newNodeIdMap.set(node.id, label)
    }
  })

  // Generate edges (using both existing and new nodes)
  const edgeResult = generateEdges(
    edgeDataArray,
    options.existingNodes,
    nodeResult.nodes,
    options.existingEdges,
    nodeResult.labelToIdMap,
    newNodeIdMap
  )

  return {
    nodes: nodeResult.nodes,
    edges: edgeResult.edges,
    nextNodeIdCounter: nodeResult.nextNodeIdCounter,
    errors: [...nodeResult.errors, ...edgeResult.errors],
    warnings: [...nodeResult.warnings, ...edgeResult.warnings]
  }
}

