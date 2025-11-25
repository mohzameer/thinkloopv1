/**
 * Response Parser
 * 
 * Parses and validates AI responses from Claude API
 * Handles ADD, ANSWER, and CLARIFY action types
 */

export type NodeType = 'rectangle' | 'circle' | 'diamond' | 'triangle'

export interface NodeData {
  label: string // Required - label text for the node
  type?: NodeType
  position?: { x: number; y: number }
  positionRelative?: { relativeTo: string; offset: { x: number; y: number } }
  tags?: string[] // Optional - tags/categories are not added to nodes (user adds manually)
}

export interface EdgeData {
  source: string  // Node ID or label
  target: string  // Node ID or label
  label?: string
}

export type AIResponse =
  | { action: 'add'; nodes: NodeData[]; edges: EdgeData[]; explanation: string }
  | { action: 'answer'; response: string }
  | { action: 'clarify'; questions: string[]; context: string }
  | { action: 'error'; message: string }

/**
 * Extract JSON from text (handles markdown code blocks, etc.)
 */
function extractJSON(text: string): any | null {
  // Try to parse as-is first
  try {
    return JSON.parse(text.trim())
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1])
      } catch {
        // Continue to other methods
      }
    }

    // Try to find JSON object in text
    const objectMatch = text.match(/\{[\s\S]*\}/)
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0])
      } catch {
        // Continue
      }
    }

    return null
  }
}

/**
 * Validate node data
 */
function validateNodeData(node: any): NodeData | null {
  if (!node || typeof node !== 'object') {
    return null
  }

  // Label is required for node creation
  if (!node.label || typeof node.label !== 'string') {
    return null
  }

  // Validate type
  const validTypes: NodeType[] = ['rectangle', 'circle', 'diamond', 'triangle']
  const type = validTypes.includes(node.type) ? node.type : 'rectangle' // Default to rectangle

  // Validate position (if provided)
  let position: { x: number; y: number } | undefined
  if (node.position) {
    if (
      typeof node.position.x === 'number' &&
      typeof node.position.y === 'number'
    ) {
      position = { x: node.position.x, y: node.position.y }
    }
  }

  // Validate relative position (if provided)
  let positionRelative: { relativeTo: string; offset: { x: number; y: number } } | undefined
  if (node.positionRelative) {
    if (
      typeof node.positionRelative.relativeTo === 'string' &&
      typeof node.positionRelative.offset?.x === 'number' &&
      typeof node.positionRelative.offset?.y === 'number'
    ) {
      positionRelative = {
        relativeTo: node.positionRelative.relativeTo,
        offset: {
          x: node.positionRelative.offset.x,
          y: node.positionRelative.offset.y
        }
      }
    }
  }

  // Validate tags
  let tags: string[] | undefined
  if (Array.isArray(node.tags)) {
    tags = node.tags.filter((tag: any) => typeof tag === 'string')
  }

  return {
    label: node.label.trim(),
    type,
    ...(position && { position }),
    ...(positionRelative && { positionRelative })
    // Tags/categories are intentionally omitted - user adds them manually
  }
}

/**
 * Validate edge data
 */
function validateEdgeData(edge: any): EdgeData | null {
  if (!edge || typeof edge !== 'object') {
    return null
  }

  // Required fields
  if (!edge.source || typeof edge.source !== 'string') {
    return null
  }

  if (!edge.target || typeof edge.target !== 'string') {
    return null
  }

  // Optional label
  const label = edge.label && typeof edge.label === 'string' 
    ? edge.label.trim() 
    : undefined

  return {
    source: edge.source.trim(),
    target: edge.target.trim(),
    ...(label && { label })
  }
}

/**
 * Parse ADD action response
 */
function parseAddAction(data: any): AIResponse {
  if (!data.nodes || !Array.isArray(data.nodes)) {
    return {
      action: 'error',
      message: 'Invalid ADD response: missing or invalid nodes array'
    }
  }

  // Validate and parse nodes
  const nodes: NodeData[] = []
  for (const node of data.nodes) {
    const validated = validateNodeData(node)
    if (validated) {
      nodes.push(validated)
    }
  }

  if (nodes.length === 0) {
    return {
      action: 'error',
      message: 'Invalid ADD response: no valid nodes found'
    }
  }

  // Validate and parse edges (optional)
  const edges: EdgeData[] = []
  if (data.edges && Array.isArray(data.edges)) {
    for (const edge of data.edges) {
      const validated = validateEdgeData(edge)
      if (validated) {
        edges.push(validated)
      }
    }
  }

  // Get explanation
  const explanation = data.explanation && typeof data.explanation === 'string'
    ? data.explanation.trim()
    : `Added ${nodes.length} node(s)${edges.length > 0 ? ` and ${edges.length} edge(s)` : ''}`

  return {
    action: 'add',
    nodes,
    edges,
    explanation
  }
}

/**
 * Parse ANSWER action response
 */
function parseAnswerAction(data: any, rawResponse: string): AIResponse {
  const response = data.response && typeof data.response === 'string'
    ? data.response.trim()
    : rawResponse.trim()

  if (!response) {
    return {
      action: 'error',
      message: 'Invalid ANSWER response: empty response'
    }
  }

  return {
    action: 'answer',
    response
  }
}

/**
 * Parse CLARIFY action response
 */
function parseClarifyAction(data: any): AIResponse {
  if (!data.questions || !Array.isArray(data.questions)) {
    return {
      action: 'error',
      message: 'Invalid CLARIFY response: missing or invalid questions array'
    }
  }

  const questions = data.questions
    .filter((q: any) => typeof q === 'string')
    .map((q: string) => q.trim())
    .filter((q: string) => q.length > 0)

  if (questions.length === 0) {
    return {
      action: 'error',
      message: 'Invalid CLARIFY response: no valid questions found'
    }
  }

  const context = data.context && typeof data.context === 'string'
    ? data.context.trim()
    : 'I need more information to help you.'

  return {
    action: 'clarify',
    questions,
    context
  }
}

/**
 * Parse AI response from Claude API
 * 
 * @param response - Raw response text from Claude
 * @returns Parsed and validated AI response
 */
export function parseAIResponse(response: string): AIResponse {
  if (!response || typeof response !== 'string') {
    return {
      action: 'error',
      message: 'Invalid response: empty or not a string'
    }
  }

  const trimmed = response.trim()
  if (!trimmed) {
    return {
      action: 'error',
      message: 'Invalid response: empty string'
    }
  }

  // Try to extract JSON
  const jsonData = extractJSON(trimmed)

  // If no JSON found, treat as natural language answer
  if (!jsonData) {
    return {
      action: 'answer',
      response: trimmed
    }
  }

  // Validate action field
  if (!jsonData.action || typeof jsonData.action !== 'string') {
    return {
      action: 'error',
      message: 'Invalid response: missing or invalid action field'
    }
  }

  const action = jsonData.action.toLowerCase()

  // Parse based on action type
  switch (action) {
    case 'add':
      return parseAddAction(jsonData)

    case 'answer':
      return parseAnswerAction(jsonData, trimmed)

    case 'clarify':
      return parseClarifyAction(jsonData)

    default:
      // Unknown action, try to parse as answer
      if (jsonData.response) {
        return parseAnswerAction(jsonData, trimmed)
      }
      
      // If it looks like it might be an add action without action field
      if (jsonData.nodes) {
        return parseAddAction(jsonData)
      }

      return {
        action: 'error',
        message: `Unknown action type: ${action}`
      }
  }
}

/**
 * Check if response is an error
 */
export function isErrorResponse(response: AIResponse): response is { action: 'error'; message: string } {
  return response.action === 'error'
}

/**
 * Check if response is an ADD action
 */
export function isAddResponse(response: AIResponse): response is { action: 'add'; nodes: NodeData[]; edges: EdgeData[]; explanation: string } {
  return response.action === 'add'
}

/**
 * Check if response is an ANSWER action
 */
export function isAnswerResponse(response: AIResponse): response is { action: 'answer'; response: string } {
  return response.action === 'answer'
}

/**
 * Check if response is a CLARIFY action
 */
export function isClarifyResponse(response: AIResponse): response is { action: 'clarify'; questions: string[]; context: string } {
  return response.action === 'clarify'
}

