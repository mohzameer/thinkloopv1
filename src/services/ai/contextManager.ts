/**
 * Context Window Manager
 * 
 * Manages context window size, token tracking, warnings, and truncation
 * Integrates tokenCounter and contextExtractor
 */

import type { Node, Edge } from '@xyflow/react'
import { 
  TOKEN_LIMITS, 
  countTokens, 
  countMessagesTokens, 
  checkTokenLimits,
  type WarningLevel 
} from './tokenCounter'
import { 
  extractCanvasContext, 
  getCanvasSummary,
  type ExtractOptions 
} from './contextExtractor'

export interface ContextWarning {
  level: WarningLevel
  tokenCount: number
  tokenLimit: number
  percentage: number
  message: string
  truncated?: {
    messages?: number
    nodes?: number
    edges?: number
  }
  included: {
    messages: number
    nodes: number
    edges: number
  }
}

export interface TruncationResult {
  messages: Array<{ role: string; content: string }>
  canvasContext: string
  summary: {
    totalTokens: number
    systemTokens: number
    messagesTokens: number
    contextTokens: number
    overhead: number
  }
  warning: ContextWarning | null
}

export interface ContextComponents {
  systemPrompt: string
  messages: Array<{ role: string; content: string }>
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds?: string[]
}

/**
 * Truncate messages array, keeping the most recent ones
 */
function truncateMessages(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): {
  messages: Array<{ role: string; content: string }>
  truncated: number
} {
  if (messages.length === 0) {
    return { messages: [], truncated: 0 }
  }

  // Start from the end (most recent) and work backwards
  const kept: Array<{ role: string; content: string }> = []
  let totalTokens = 0
  let truncated = 0

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    const messageTokens = countTokens(message.content) + 20 // +20 for message structure
    
    if (totalTokens + messageTokens <= maxTokens) {
      kept.unshift(message) // Add to beginning to maintain order
      totalTokens += messageTokens
    } else {
      truncated = i + 1
      break
    }
  }

  return { messages: kept, truncated }
}

/**
 * Calculate how many nodes we can include given token budget
 */
function calculateMaxNodes(
  nodes: Node[],
  edges: Edge[],
  tokenBudget: number,
  options: ExtractOptions
): number {
  if (nodes.length === 0) return 0

  // Estimate tokens per node (rough approximation)
  // Each node: ~50 tokens (ID, type, label, tags, position)
  // Each edge: ~30 tokens (source, target, label)
  const tokensPerNode = 50
  const tokensPerEdge = 30
  const overhead = 200 // Graph analysis and structure

  // Binary search for optimal node count
  let low = 0
  let high = nodes.length
  let best = 0

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const estimatedTokens = (mid * tokensPerNode) + 
                           (edges.length * tokensPerEdge) + 
                           overhead

    if (estimatedTokens <= tokenBudget) {
      best = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return Math.max(1, best) // At least include 1 node
}

/**
 * Manage context and apply truncation if needed
 */
export function manageContext(
  components: ContextComponents,
  options: {
    includePositions?: boolean
    includeTags?: boolean
    includeGraphAnalysis?: boolean
  } = {}
): TruncationResult {
  const {
    systemPrompt = '',
    messages = [],
    nodes = [],
    edges = [],
    selectedNodeIds = []
  } = components

  // Calculate token usage for each component
  const systemTokens = countTokens(systemPrompt)
  const messagesTokens = countMessagesTokens(messages)
  
  // Initial canvas context (full)
  const fullCanvasContext = extractCanvasContext(nodes, edges, {
    includePositions: options.includePositions ?? true,
    includeTags: options.includeTags ?? true,
    includeGraphAnalysis: options.includeGraphAnalysis ?? true,
    selectedNodeIds
  })
  const fullContextTokens = countTokens(fullCanvasContext)

  // Calculate total with overhead
  const overhead = 100 // API request structure overhead
  let totalTokens = systemTokens + messagesTokens + fullContextTokens + overhead

  // Check if we need truncation
  const limitCheck = checkTokenLimits(totalTokens)
  let finalMessages = messages
  let finalCanvasContext = fullCanvasContext
  let truncatedMessages = 0
  let truncatedNodes = nodes.length

  // If we exceed limits, apply truncation
  if (limitCheck.warningLevel === 'warning' || limitCheck.warningLevel === 'critical') {
    // Calculate available budget (reserve for system prompt and response)
    const availableBudget = TOKEN_LIMITS.WARNING_LIMIT - 
                            systemTokens - 
                            TOKEN_LIMITS.RESPONSE_RESERVE - 
                            overhead

    // Priority 1: Truncate old messages (keep last 10-15)
    const messageBudget = Math.floor(availableBudget * 0.3) // 30% for messages
    const messageResult = truncateMessages(messages, messageBudget)
    finalMessages = messageResult.messages
    truncatedMessages = messageResult.truncated

    // Priority 2: Truncate canvas context
    const contextBudget = availableBudget - countMessagesTokens(finalMessages)
    const maxNodes = calculateMaxNodes(nodes, edges, contextBudget, {
      includePositions: options.includePositions ?? true,
      includeTags: options.includeTags ?? true,
      includeGraphAnalysis: options.includeGraphAnalysis ?? true,
      selectedNodeIds
    })

    // Extract truncated context
    finalCanvasContext = extractCanvasContext(nodes, edges, {
      includePositions: options.includePositions ?? true,
      includeTags: options.includeTags ?? true,
      maxNodes,
      selectedNodeIds,
      includeGraphAnalysis: options.includeGraphAnalysis ?? true
    })
    truncatedNodes = nodes.length - maxNodes

    // Recalculate total
    const finalMessagesTokens = countMessagesTokens(finalMessages)
    const finalContextTokens = countTokens(finalCanvasContext)
    totalTokens = systemTokens + finalMessagesTokens + finalContextTokens + overhead
  }

  // Get final warning status
  const finalLimitCheck = checkTokenLimits(totalTokens)

  // Build warning object
  const warning: ContextWarning | null = finalLimitCheck.warningLevel !== 'none' ? {
    level: finalLimitCheck.warningLevel,
    tokenCount: totalTokens,
    tokenLimit: TOKEN_LIMITS.CONTEXT_WINDOW,
    percentage: finalLimitCheck.percentage,
    message: finalLimitCheck.message,
    truncated: truncatedMessages > 0 || truncatedNodes < nodes.length ? {
      messages: truncatedMessages > 0 ? truncatedMessages : undefined,
      nodes: truncatedNodes < nodes.length ? truncatedNodes : undefined
    } : undefined,
    included: {
      messages: finalMessages.length,
      nodes: Math.min(nodes.length, truncatedNodes === nodes.length ? nodes.length : nodes.length - truncatedNodes),
      edges: edges.length
    }
  } : null

  return {
    messages: finalMessages,
    canvasContext: finalCanvasContext,
    summary: {
      totalTokens,
      systemTokens,
      messagesTokens: countMessagesTokens(finalMessages),
      contextTokens: countTokens(finalCanvasContext),
      overhead
    },
    warning
  }
}

/**
 * Get context summary for display
 */
export function getContextSummary(
  components: ContextComponents,
  truncationResult: TruncationResult
): string {
  const { nodes, edges, messages } = components
  const { summary, warning } = truncationResult

  const includedNodes = warning?.included.nodes ?? nodes.length
  const includedMessages = warning?.included.messages ?? messages.length

  let summaryText = `📊 Context Summary:\n`
  summaryText += `• ${includedNodes} nodes (${nodes.length} total)\n`
  summaryText += `• ${edges.length} edges\n`
  summaryText += `• ${includedMessages} conversation messages (${messages.length} total)\n`
  summaryText += `• Estimated: ~${Math.round(summary.totalTokens / 1000)}k tokens\n`

  if (warning?.truncated) {
    summaryText += `\n⚠️ Truncated:\n`
    if (warning.truncated.messages) {
      summaryText += `• ${warning.truncated.messages} older messages (keeping last ${includedMessages})\n`
    }
    if (warning.truncated.nodes) {
      summaryText += `• ${warning.truncated.nodes} distant nodes (keeping ${includedNodes} most relevant)\n`
    }
  }

  return summaryText
}

/**
 * Check if context can be sent (not exceeding hard limit)
 */
export function canSendContext(components: ContextComponents): {
  canSend: boolean
  warning: ContextWarning | null
} {
  const result = manageContext(components)
  const canSend = result.warning?.level !== 'critical'
  
  return {
    canSend,
    warning: result.warning
  }
}

