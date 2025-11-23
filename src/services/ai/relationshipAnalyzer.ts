/**
 * Relationship Analyzer
 * 
 * Advanced graph analysis for understanding relationships between nodes
 * Provides path finding, centrality metrics, and relationship insights
 */

import type { Node, Edge } from '@xyflow/react'

export interface PathResult {
  path: string[]
  length: number
  nodes: Node[]
  edges: Edge[]
}

export interface CentralityMetrics {
  nodeId: string
  label: string
  degree: number
  betweenness: number
  closeness: number
}

export interface Cluster {
  id: string
  nodes: string[]
  size: number
  density: number
  centralNode?: string
}

export interface RelationshipInsight {
  sourceId: string
  targetId: string
  sourceLabel: string
  targetLabel: string
  shortestPath?: PathResult
  pathLength: number
  isDirectlyConnected: boolean
  commonNeighbors: string[]
  relationshipStrength: number
}

/**
 * Get node label safely
 */
function getNodeLabel(node: Node): string {
  return (node.data?.label as string) || node.id || 'Unnamed Node'
}

/**
 * Build adjacency list from edges (bidirectional)
 */
function buildAdjacencyList(edges: Edge[]): Map<string, Set<string>> {
  const adjList = new Map<string, Set<string>>()
  
  edges.forEach(edge => {
    // Add target to source's neighbors
    if (!adjList.has(edge.source)) {
      adjList.set(edge.source, new Set())
    }
    adjList.get(edge.source)!.add(edge.target)
    
    // Add source to target's neighbors (bidirectional)
    if (!adjList.has(edge.target)) {
      adjList.set(edge.target, new Set())
    }
    adjList.get(edge.target)!.add(edge.source)
  })
  
  return adjList
}

/**
 * Find shortest path between two nodes using BFS
 */
export function findPath(
  sourceId: string,
  targetId: string,
  nodes: Node[],
  edges: Edge[]
): PathResult | null {
  if (sourceId === targetId) {
    return {
      path: [sourceId],
      length: 0,
      nodes: nodes.filter(n => n.id === sourceId),
      edges: []
    }
  }
  
  const adjList = buildAdjacencyList(edges)
  const visited = new Set<string>()
  const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: sourceId, path: [sourceId] }]
  visited.add(sourceId)
  
  while (queue.length > 0) {
    const { nodeId, path } = queue.shift()!
    
    const neighbors = adjList.get(nodeId) || new Set()
    for (const neighborId of neighbors) {
      if (neighborId === targetId) {
        // Found path
        const fullPath = [...path, neighborId]
        const pathNodes = fullPath.map(id => nodes.find(n => n.id === id)!).filter(Boolean)
        const pathEdges: Edge[] = []
        
        // Find edges along the path
        for (let i = 0; i < fullPath.length - 1; i++) {
          const edge = edges.find(
            e => (e.source === fullPath[i] && e.target === fullPath[i + 1]) ||
                 (e.source === fullPath[i + 1] && e.target === fullPath[i])
          )
          if (edge) pathEdges.push(edge)
        }
        
        return {
          path: fullPath,
          length: fullPath.length - 1,
          nodes: pathNodes,
          edges: pathEdges
        }
      }
      
      if (!visited.has(neighborId)) {
        visited.add(neighborId)
        queue.push({ nodeId: neighborId, path: [...path, neighborId] })
      }
    }
  }
  
  return null // No path found
}

/**
 * Find all paths between two nodes (up to maxDepth)
 */
export function findAllPaths(
  sourceId: string,
  targetId: string,
  nodes: Node[],
  edges: Edge[],
  maxDepth: number = 5
): PathResult[] {
  if (sourceId === targetId) {
    return [{
      path: [sourceId],
      length: 0,
      nodes: nodes.filter(n => n.id === sourceId),
      edges: []
    }]
  }
  
  const adjList = buildAdjacencyList(edges)
  const paths: PathResult[] = []
  
  function dfs(currentId: string, targetId: string, path: string[], visited: Set<string>, depth: number) {
    if (depth > maxDepth) return
    
    if (currentId === targetId) {
      const pathNodes = path.map(id => nodes.find(n => n.id === id)!).filter(Boolean)
      const pathEdges: Edge[] = []
      
      for (let i = 0; i < path.length - 1; i++) {
        const edge = edges.find(
          e => (e.source === path[i] && e.target === path[i + 1]) ||
               (e.source === path[i + 1] && e.target === path[i])
        )
        if (edge) pathEdges.push(edge)
      }
      
      paths.push({
        path: [...path],
        length: path.length - 1,
        nodes: pathNodes,
        edges: pathEdges
      })
      return
    }
    
    const neighbors = adjList.get(currentId) || new Set()
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId)
        dfs(neighborId, targetId, [...path, neighborId], visited, depth + 1)
        visited.delete(neighborId)
      }
    }
  }
  
  dfs(sourceId, targetId, [sourceId], new Set([sourceId]), 0)
  
  // Sort by length (shortest first)
  return paths.sort((a, b) => a.length - b.length)
}

/**
 * Calculate betweenness centrality for a node
 * (How often a node appears on shortest paths between other nodes)
 */
export function calculateBetweenness(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): number {
  let betweenness = 0
  const nodeIds = nodes.map(n => n.id)
  
  // For each pair of nodes (excluding current node)
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const sourceId = nodeIds[i]
      const targetId = nodeIds[j]
      
      if (sourceId === nodeId || targetId === nodeId) continue
      
      const path = findPath(sourceId, targetId, nodes, edges)
      if (path && path.path.includes(nodeId)) {
        betweenness += 1 / path.length
      }
    }
  }
  
  return betweenness
}

/**
 * Calculate closeness centrality for a node
 * (Average distance to all other nodes)
 */
export function calculateCloseness(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): number {
  let totalDistance = 0
  let reachableCount = 0
  
  for (const node of nodes) {
    if (node.id === nodeId) continue
    
    const path = findPath(nodeId, node.id, nodes, edges)
    if (path) {
      totalDistance += path.length
      reachableCount++
    }
  }
  
  if (reachableCount === 0) return 0
  return reachableCount / totalDistance
}

/**
 * Get central nodes with various centrality metrics
 */
export function getCentralNodes(
  nodes: Node[],
  edges: Edge[],
  topN: number = 5
): CentralityMetrics[] {
  const adjList = buildAdjacencyList(edges)
  const metrics: CentralityMetrics[] = []
  
  for (const node of nodes) {
    const degree = (adjList.get(node.id) || new Set()).size
    const betweenness = calculateBetweenness(node.id, nodes, edges)
    const closeness = calculateCloseness(node.id, nodes, edges)
    
    metrics.push({
      nodeId: node.id,
      label: getNodeLabel(node),
      degree,
      betweenness,
      closeness
    })
  }
  
  // Sort by combined centrality score (weighted)
  return metrics
    .sort((a, b) => {
      const scoreA = a.degree * 0.4 + a.betweenness * 0.4 + a.closeness * 0.2
      const scoreB = b.degree * 0.4 + b.betweenness * 0.4 + b.closeness * 0.2
      return scoreB - scoreA
    })
    .slice(0, topN)
}

/**
 * Detect clusters (connected components) with enhanced analysis
 */
export function detectClusters(
  nodes: Node[],
  edges: Edge[]
): Cluster[] {
  const adjList = buildAdjacencyList(edges)
  const visited = new Set<string>()
  const clusters: Cluster[] = []
  
  function dfs(nodeId: string, cluster: string[]) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    cluster.push(nodeId)
    
    const neighbors = adjList.get(nodeId) || new Set()
    neighbors.forEach(neighborId => {
      if (!visited.has(neighborId)) {
        dfs(neighborId, cluster)
      }
    })
  }
  
  // Find all connected components
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const cluster: string[] = []
      dfs(node.id, cluster)
      
      if (cluster.length > 1) {
        // Calculate cluster density
        const clusterEdges = edges.filter(
          e => cluster.includes(e.source) && cluster.includes(e.target)
        )
        const maxPossibleEdges = (cluster.length * (cluster.length - 1)) / 2
        const density = maxPossibleEdges > 0 ? clusterEdges.length / maxPossibleEdges : 0
        
        // Find central node in cluster (highest degree)
        const clusterNodeDegrees = cluster.map(id => ({
          id,
          degree: (adjList.get(id) || new Set()).size
        }))
        const centralNode = clusterNodeDegrees.reduce(
          (max, node) => node.degree > max.degree ? node : max,
          clusterNodeDegrees[0]
        )
        
        clusters.push({
          id: `cluster-${clusters.length + 1}`,
          nodes: cluster,
          size: cluster.length,
          density,
          centralNode: centralNode.id
        })
      }
    }
  }
  
  return clusters.sort((a, b) => b.size - a.size)
}

/**
 * Get isolated nodes (no connections)
 */
export function getIsolatedNodes(nodes: Node[], edges: Edge[]): Node[] {
  const connectedNodes = new Set<string>()
  
  edges.forEach(edge => {
    connectedNodes.add(edge.source)
    connectedNodes.add(edge.target)
  })
  
  return nodes.filter(node => !connectedNodes.has(node.id))
}

/**
 * Analyze relationship between two nodes
 */
export function analyzeRelationship(
  sourceId: string,
  targetId: string,
  nodes: Node[],
  edges: Edge[]
): RelationshipInsight {
  const sourceNode = nodes.find(n => n.id === sourceId)
  const targetNode = nodes.find(n => n.id === targetId)
  
  if (!sourceNode || !targetNode) {
    throw new Error('Source or target node not found')
  }
  
  const adjList = buildAdjacencyList(edges)
  const sourceNeighbors = adjList.get(sourceId) || new Set()
  const targetNeighbors = adjList.get(targetId) || new Set()
  
  // Check if directly connected
  const isDirectlyConnected = sourceNeighbors.has(targetId) || targetNeighbors.has(sourceId)
  
  // Find common neighbors
  const commonNeighbors = Array.from(sourceNeighbors).filter(id => targetNeighbors.has(id))
  
  // Find shortest path
  const shortestPath = findPath(sourceId, targetId, nodes, edges)
  
  // Calculate relationship strength
  // Based on: direct connection, path length, common neighbors
  let relationshipStrength = 0
  if (isDirectlyConnected) {
    relationshipStrength = 1.0
  } else if (shortestPath) {
    relationshipStrength = 1.0 / (shortestPath.length + 1)
  }
  relationshipStrength += commonNeighbors.length * 0.1
  
  return {
    sourceId,
    targetId,
    sourceLabel: getNodeLabel(sourceNode),
    targetLabel: getNodeLabel(targetNode),
    shortestPath: shortestPath || undefined,
    pathLength: shortestPath?.length ?? Infinity,
    isDirectlyConnected,
    commonNeighbors,
    relationshipStrength: Math.min(1.0, relationshipStrength)
  }
}

/**
 * Find bridge nodes (nodes whose removal would disconnect the graph)
 */
export function findBridgeNodes(nodes: Node[], edges: Edge[]): string[] {
  const bridgeNodes: string[] = []
  const adjList = buildAdjacencyList(edges)
  
  for (const node of nodes) {
    // Temporarily remove node and check connectivity
    const tempAdjList = new Map(adjList)
    tempAdjList.delete(node.id)
    
    // Remove node from all neighbor lists
    tempAdjList.forEach((neighbors, nodeId) => {
      neighbors.delete(node.id)
    })
    
    // Check if graph becomes disconnected
    if (nodes.length > 1) {
      const visited = new Set<string>()
      const startNode = nodes.find(n => n.id !== node.id)
      
      if (startNode) {
        function dfs(nodeId: string) {
          if (visited.has(nodeId)) return
          visited.add(nodeId)
          const neighbors = tempAdjList.get(nodeId) || new Set()
          neighbors.forEach(neighborId => dfs(neighborId))
        }
        
        dfs(startNode.id)
        
        // If not all nodes (except removed one) are visited, it's a bridge
        if (visited.size < nodes.length - 1) {
          bridgeNodes.push(node.id)
        }
      }
    }
  }
  
  return bridgeNodes
}

/**
 * Get comprehensive relationship analysis for the graph
 */
export function getRelationshipAnalysis(
  nodes: Node[],
  edges: Edge[]
): {
  centralNodes: CentralityMetrics[]
  clusters: Cluster[]
  isolatedNodes: Node[]
  bridgeNodes: string[]
  averagePathLength: number
  graphDensity: number
} {
  const centralNodes = getCentralNodes(nodes, edges, 5)
  const clusters = detectClusters(nodes, edges)
  const isolatedNodes = getIsolatedNodes(nodes, edges)
  const bridgeNodes = findBridgeNodes(nodes, edges)
  
  // Calculate average path length
  let totalPathLength = 0
  let pathCount = 0
  
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const path = findPath(nodes[i].id, nodes[j].id, nodes, edges)
      if (path) {
        totalPathLength += path.length
        pathCount++
      }
    }
  }
  
  const averagePathLength = pathCount > 0 ? totalPathLength / pathCount : 0
  
  // Calculate graph density
  const maxPossibleEdges = (nodes.length * (nodes.length - 1)) / 2
  const graphDensity = maxPossibleEdges > 0 ? edges.length / maxPossibleEdges : 0
  
  return {
    centralNodes,
    clusters,
    isolatedNodes,
    bridgeNodes,
    averagePathLength,
    graphDensity
  }
}

