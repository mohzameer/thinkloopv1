/**
 * Canvas Context Extractor
 * 
 * Converts React Flow nodes and edges into structured text format
 * for AI consumption. Includes graph analysis and relationship information.
 */

import type { Node, Edge } from '@xyflow/react'
import type { Tag } from '../../types/firebase'
import { getRelationshipAnalysis } from './relationshipAnalyzer'

export interface ExtractOptions {
  includePositions?: boolean
  includeTags?: boolean
  maxNodes?: number
  selectedNodeIds?: string[]
  includeGraphAnalysis?: boolean
}

export interface GraphAnalysis {
  totalNodes: number
  totalEdges: number
  centralNodes: Array<{ id: string; label: string; connectionCount: number }>
  isolatedNodes: Array<{ id: string; label: string }>
  clusters: Array<{ nodes: string[]; size: number }>
  nodeConnections: Map<string, number>
}

/**
 * Get node label safely
 */
function getNodeLabel(node: Node): string {
  return (node.data?.label as string) || node.id || 'Unnamed Node'
}

/**
 * Get node tags/categories safely
 */
function getNodeTags(node: Node): string[] {
  const categories = (node.data as any)?.categories || []
  const tags = (node.data as any)?.tags || []
  
  // If categories exist, use them (they're tag names)
  if (Array.isArray(categories) && categories.length > 0) {
    return categories
  }
  
  // Otherwise, extract tag names from Tag objects
  if (Array.isArray(tags) && tags.length > 0) {
    return tags.map((tag: Tag | string) => 
      typeof tag === 'string' ? tag : tag.name
    )
  }
  
  return []
}

/**
 * Analyze graph structure
 */
function analyzeGraph(nodes: Node[], edges: Edge[]): GraphAnalysis {
  const nodeConnections = new Map<string, number>()
  const nodeToNeighbors = new Map<string, Set<string>>()
  
  // Initialize all nodes
  nodes.forEach(node => {
    nodeConnections.set(node.id, 0)
    nodeToNeighbors.set(node.id, new Set())
  })
  
  // Count connections
  edges.forEach(edge => {
    const sourceCount = nodeConnections.get(edge.source) || 0
    const targetCount = nodeConnections.get(edge.target) || 0
    
    nodeConnections.set(edge.source, sourceCount + 1)
    nodeConnections.set(edge.target, targetCount + 1)
    
    // Track neighbors
    const sourceNeighbors = nodeToNeighbors.get(edge.source) || new Set()
    const targetNeighbors = nodeToNeighbors.get(edge.target) || new Set()
    sourceNeighbors.add(edge.target)
    targetNeighbors.add(edge.source)
    nodeToNeighbors.set(edge.source, sourceNeighbors)
    nodeToNeighbors.set(edge.target, targetNeighbors)
  })
  
  // Find central nodes (top 5 by connection count)
  const centralNodes = Array.from(nodeConnections.entries())
    .map(([id, count]) => {
      const node = nodes.find(n => n.id === id)
      return {
        id,
        label: node ? getNodeLabel(node) : id,
        connectionCount: count
      }
    })
    .filter(node => node.connectionCount > 0)
    .sort((a, b) => b.connectionCount - a.connectionCount)
    .slice(0, 5)
  
  // Find isolated nodes (no connections)
  const isolatedNodes = Array.from(nodeConnections.entries())
    .filter(([_, count]) => count === 0)
    .map(([id]) => {
      const node = nodes.find(n => n.id === id)
      return {
        id,
        label: node ? getNodeLabel(node) : id
      }
    })
  
  // Simple cluster detection (connected components)
  const visited = new Set<string>()
  const clusters: Array<{ nodes: string[]; size: number }> = []
  
  function dfs(nodeId: string, cluster: string[]) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    cluster.push(nodeId)
    
    const neighbors = nodeToNeighbors.get(nodeId) || new Set()
    neighbors.forEach(neighborId => {
      if (!visited.has(neighborId)) {
        dfs(neighborId, cluster)
      }
    })
  }
  
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      const cluster: string[] = []
      dfs(node.id, cluster)
      if (cluster.length > 1) {
        clusters.push({ nodes: cluster, size: cluster.length })
      }
    }
  })
  
  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    centralNodes,
    isolatedNodes,
    clusters,
    nodeConnections
  }
}

/**
 * Serialize a single node to text format
 * Emphasizes the node label text as it contains the main content/context
 */
function serializeNode(node: Node, options: ExtractOptions, nodeIndex: number): string {
  const label = getNodeLabel(node)
  const type = node.type || 'rectangle'
  const tags = options.includeTags ? getNodeTags(node) : []
  
  // Node label can be multi-line, so we format it clearly
  const labelLines = label.split('\n')
  const isMultiLine = labelLines.length > 1
  
  let nodeStr = `  * Node ${nodeIndex + 1} [ID: "${node.id}", Type: ${type}`
  
  // Emphasize the label content (this is the main context for the node)
  if (isMultiLine) {
    nodeStr += `\n    Content/Label:\n${labelLines.map(line => `      "${line}"`).join('\n')}`
  } else {
    nodeStr += `, Label/Content: "${label}"`
  }
  
  if (tags.length > 0) {
    nodeStr += `\n    Tags: [${tags.map(t => `"${t}"`).join(', ')}]`
  }
  
  if (options.includePositions && node.position) {
    nodeStr += `\n    Position: (${Math.round(node.position.x)}, ${Math.round(node.position.y)})`
  }
  
  nodeStr += ']'
  
  return nodeStr
}

/**
 * Serialize a single edge to text format
 * Emphasizes edge labels as they describe the relationship between nodes
 */
function serializeEdge(
  edge: Edge,
  _options: ExtractOptions,
  edgeIndex: number,
  nodeMap: Map<string, Node>
): string {
  const sourceNode = nodeMap.get(edge.source)
  const targetNode = nodeMap.get(edge.target)
  const sourceLabel = sourceNode ? getNodeLabel(sourceNode) : edge.source
  const targetLabel = targetNode ? getNodeLabel(targetNode) : edge.target
  
  const edgeLabel = (edge.data as any)?.label
  
  // Emphasize edge labels - they describe the relationship
  if (edgeLabel) {
    // Edge label is crucial for understanding relationships
    let edgeStr = `  * Edge ${edgeIndex + 1}: "${sourceLabel}" → "${targetLabel}"`
    edgeStr += `\n    Relationship: "${edgeLabel}"`
    return edgeStr
  } else {
    // No label, just show the connection
    return `  * Edge ${edgeIndex + 1}: "${sourceLabel}" → "${targetLabel}"`
  }
}

/**
 * Extract and serialize canvas context to structured text
 */
export function extractCanvasContext(
  nodes: Node[],
  edges: Edge[],
  options: ExtractOptions = {}
): string {
  const {
    maxNodes,
    selectedNodeIds = [],
    includeGraphAnalysis = true
  } = options
  
  if (nodes.length === 0 && edges.length === 0) {
    return 'CANVAS STRUCTURE:\n- Canvas is empty (no nodes or edges)'
  }
  
  // Create node map for quick lookup
  const nodeMap = new Map<string, Node>()
  nodes.forEach(node => nodeMap.set(node.id, node))
  
  // Prioritize selected nodes
  let nodesToInclude = [...nodes]
  if (selectedNodeIds.length > 0) {
    // Sort: selected nodes first, then others
    const selected = nodes.filter(n => selectedNodeIds.includes(n.id))
    const others = nodes.filter(n => !selectedNodeIds.includes(n.id))
    nodesToInclude = [...selected, ...others]
  }
  
  // Limit nodes if maxNodes specified
  if (maxNodes && maxNodes > 0 && nodesToInclude.length > maxNodes) {
    nodesToInclude = nodesToInclude.slice(0, maxNodes)
  }
  
  // Filter edges to only include those connecting included nodes
  const includedNodeIds = new Set(nodesToInclude.map(n => n.id))
  const edgesToInclude = edges.filter(edge =>
    includedNodeIds.has(edge.source) && includedNodeIds.has(edge.target)
  )
  
  // Build context string
  let context = 'CANVAS STRUCTURE:\n'
  context += 'NOTE: Node labels contain the main content/text for each node. Edge labels describe relationships.\n'
  context += 'Pay close attention to the full text in node labels and edge labels to understand context and relationships.\n\n'
  
  // Nodes section
  context += `- Nodes (${nodes.length} total, showing ${nodesToInclude.length}):\n`
  nodesToInclude.forEach((node, index) => {
    context += serializeNode(node, options, index) + '\n'
  })
  
  if (nodes.length > nodesToInclude.length) {
    context += `  ... (${nodes.length - nodesToInclude.length} more nodes not shown)\n`
  }
  
  // Edges section
  context += `\n- Edges (${edges.length} total, showing ${edgesToInclude.length}):\n`
  if (edgesToInclude.length === 0) {
    context += '  * No edges connecting the shown nodes\n'
  } else {
    edgesToInclude.forEach((edge, index) => {
      context += serializeEdge(edge, options, index, nodeMap) + '\n'
    })
  }
  
  if (edges.length > edgesToInclude.length) {
    context += `  ... (${edges.length - edgesToInclude.length} more edges not shown)\n`
  }
  
  // Graph analysis section (enhanced with relationship analyzer)
  if (includeGraphAnalysis) {
    const basicAnalysis = analyzeGraph(nodes, edges)
    const enhancedAnalysis = getRelationshipAnalysis(nodes, edges)
    
    context += '\n- Graph Analysis:\n'
    context += `  * Total: ${basicAnalysis.totalNodes} nodes, ${basicAnalysis.totalEdges} edges\n`
    context += `  * Graph Density: ${(enhancedAnalysis.graphDensity * 100).toFixed(1)}%\n`
    context += `  * Average Path Length: ${enhancedAnalysis.averagePathLength.toFixed(2)}\n`
    
    if (enhancedAnalysis.centralNodes.length > 0) {
      context += `  * Central nodes (by centrality):\n`
      enhancedAnalysis.centralNodes.slice(0, 5).forEach(node => {
        context += `    - "${node.label}" (Degree: ${node.degree}, Betweenness: ${node.betweenness.toFixed(2)})\n`
      })
    }
    
    if (enhancedAnalysis.isolatedNodes.length > 0) {
      context += `  * Isolated nodes: ${enhancedAnalysis.isolatedNodes.length}\n`
      if (enhancedAnalysis.isolatedNodes.length <= 5) {
        enhancedAnalysis.isolatedNodes.forEach(node => {
          context += `    - "${getNodeLabel(node)}"\n`
        })
      }
    }
    
    if (enhancedAnalysis.clusters.length > 0) {
      context += `  * Clusters: ${enhancedAnalysis.clusters.length} groups\n`
      enhancedAnalysis.clusters.slice(0, 3).forEach((cluster, idx) => {
        const centralNode = nodes.find(n => n.id === cluster.centralNode)
        const centralLabel = centralNode ? getNodeLabel(centralNode) : 'N/A'
        context += `    - Cluster ${idx + 1}: ${cluster.size} nodes, Density: ${(cluster.density * 100).toFixed(1)}%, Central: "${centralLabel}"\n`
      })
    }
    
    if (enhancedAnalysis.bridgeNodes.length > 0) {
      context += `  * Bridge nodes (critical): ${enhancedAnalysis.bridgeNodes.length}\n`
      enhancedAnalysis.bridgeNodes.slice(0, 3).forEach(nodeId => {
        const node = nodes.find(n => n.id === nodeId)
        if (node) {
          context += `    - "${getNodeLabel(node)}"\n`
        }
      })
    }
    
    if (basicAnalysis.totalEdges === 0) {
      context += '  * All nodes are disconnected\n'
    }
  }
  
  return context.trim()
}

/**
 * Get a summary of canvas context (for truncation scenarios)
 */
export function getCanvasSummary(nodes: Node[], edges: Edge[]): string {
  if (nodes.length === 0) {
    return 'Empty canvas'
  }
  
  const analysis = analyzeGraph(nodes, edges)
  
  let summary = `Canvas with ${nodes.length} nodes and ${edges.length} edges`
  
  if (analysis.centralNodes.length > 0) {
    const topNode = analysis.centralNodes[0]
    summary += `. Main focus: "${topNode.label}" (${topNode.connectionCount} connections)`
  }
  
  if (analysis.clusters.length > 0) {
    summary += `. ${analysis.clusters.length} connected groups`
  }
  
  if (analysis.isolatedNodes.length > 0) {
    summary += `. ${analysis.isolatedNodes.length} isolated nodes`
  }
  
  return summary
}

