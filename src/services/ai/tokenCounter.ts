/**
 * Token Counter Service
 * 
 * Counts tokens for Claude API requests using approximation method.
 * Approximation: ~4 characters per token (reasonably accurate for most text)
 * 
 * Note: For production, consider using @anthropic-ai/tokenizer for exact counts
 * 
 * Performance: Uses memoization for frequently called functions
 */

// Simple cache for token counts (LRU-style, max 100 entries)
const tokenCache = new Map<string, number>()
const MAX_CACHE_SIZE = 100

// Token limits for Claude Sonnet 4.5
export const TOKEN_LIMITS = {
  CONTEXT_WINDOW: 200_000,      // Total context window
  SOFT_LIMIT: 150_000,          // 75% - Show info warning
  WARNING_LIMIT: 180_000,        // 90% - Show warning, auto-truncate
  HARD_LIMIT: 190_000,          // 95% - Prevent send, require action
  RESPONSE_RESERVE: 20_000,     // Reserve for AI response
} as const

/**
 * Approximate token count for a text string
 * Uses ~4 characters per token approximation
 * Caches results for performance
 * 
 * @param text - Text to count tokens for
 * @returns Estimated token count
 */
export function countTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0
  }

  // Check cache first
  if (tokenCache.has(text)) {
    return tokenCache.get(text)!
  }

  // Rough approximation: ~4 characters per token
  // This is reasonably accurate for English text
  // For more accuracy, consider using @anthropic-ai/tokenizer
  const count = Math.ceil(text.length / 4)

  // Cache result (with simple LRU eviction)
  if (tokenCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry (first key)
    const firstKey = tokenCache.keys().next().value
    tokenCache.delete(firstKey)
  }
  tokenCache.set(text, count)

  return count
}

/**
 * Clear token cache (useful for testing or memory management)
 */
export function clearTokenCache(): void {
  tokenCache.clear()
}

/**
 * Estimate tokens for structured data (objects, arrays)
 * Converts to JSON string and counts tokens
 * 
 * @param data - Data to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(data: unknown): number {
  if (data === null || data === undefined) {
    return 0
  }

  // Convert to JSON string for counting
  try {
    const jsonString = JSON.stringify(data)
    return countTokens(jsonString)
  } catch (error) {
    console.warn('[tokenCounter] Error stringifying data:', error)
    // Fallback: estimate based on type
    if (typeof data === 'string') {
      return countTokens(data)
    }
    return 100 // Conservative estimate for unknown types
  }
}

/**
 * Count tokens for an array of strings
 * 
 * @param texts - Array of text strings
 * @returns Total token count
 */
export function countTokensArray(texts: string[]): number {
  return texts.reduce((total, text) => total + countTokens(text), 0)
}

/**
 * Count tokens for a message object (role + content)
 * 
 * @param message - Message object with role and content
 * @returns Total token count
 */
export function countMessageTokens(message: { role: string; content: string }): number {
  const roleTokens = countTokens(message.role || '')
  const contentTokens = countTokens(message.content || '')
  // Add overhead for message structure (~10 tokens)
  return roleTokens + contentTokens + 10
}

/**
 * Count tokens for an array of messages
 * 
 * @param messages - Array of message objects
 * @returns Total token count
 */
export function countMessagesTokens(messages: Array<{ role: string; content: string }>): number {
  return messages.reduce((total, message) => total + countMessageTokens(message), 0)
}

/**
 * Get total token count for a complete request
 * Includes system prompt, messages, and canvas context
 * 
 * @param systemPrompt - System prompt text
 * @param messages - Conversation messages
 * @param canvasContext - Canvas context string
 * @returns Total estimated token count
 */
export function getTotalTokenCount(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  canvasContext: string
): number {
  const systemTokens = countTokens(systemPrompt)
  const messagesTokens = countMessagesTokens(messages)
  const contextTokens = countTokens(canvasContext)
  
  // Add overhead for API request structure (~50 tokens)
  const overhead = 50
  
  return systemTokens + messagesTokens + contextTokens + overhead
}

export type WarningLevel = 'none' | 'info' | 'warning' | 'critical'

/**
 * Check if token count exceeds limits
 * 
 * @param tokenCount - Current token count
 * @returns Object with limit status and warnings
 */
export function checkTokenLimits(tokenCount: number): {
  isWithinLimit: boolean
  warningLevel: WarningLevel
  percentage: number
  message: string
} {
  const percentage = (tokenCount / TOKEN_LIMITS.CONTEXT_WINDOW) * 100

  if (tokenCount >= TOKEN_LIMITS.HARD_LIMIT) {
    return {
      isWithinLimit: false,
      warningLevel: 'critical',
      percentage,
      message: `🚨 Context limit nearly reached (${Math.round(percentage)}%). Only selected nodes and recent messages will be sent. Consider simplifying your canvas or starting a new conversation.`
    }
  }

  if (tokenCount >= TOKEN_LIMITS.WARNING_LIMIT) {
    return {
      isWithinLimit: true,
      warningLevel: 'warning',
      percentage,
      message: `⚠️ Approaching context limit (${Math.round(percentage)}%). Truncating older messages and summarizing canvas structure.`
    }
  }

  if (tokenCount >= TOKEN_LIMITS.SOFT_LIMIT) {
    return {
      isWithinLimit: true,
      warningLevel: 'info',
      percentage,
      message: `ℹ️ Large canvas detected. Using ~${Math.round(tokenCount / 1000)}k tokens. Some context may be summarized.`
    }
  }

  return {
    isWithinLimit: true,
    warningLevel: 'none',
    percentage,
    message: ''
  }
}

