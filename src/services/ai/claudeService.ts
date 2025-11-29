/**
 * Claude API Service
 * 
 * Handles communication with Claude Sonnet 4.5 API
 * Uses fetch API (can be upgraded to @anthropic-ai/sdk later if needed)
 */

export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ClaudeRequestOptions {
  system?: string
  messages: ClaudeMessage[]
  maxTokens?: number
  temperature?: number
  model?: string
}

export interface ClaudeResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  error?: string
}

export interface ClaudeError {
  type: 'api_error' | 'network_error' | 'timeout' | 'invalid_key' | 'rate_limit' | 'unknown'
  message: string
  statusCode?: number
  retryable: boolean
}

// API Configuration
// Backend API URL - backend handles CORS and API key authentication
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL 
  ? `${import.meta.env.VITE_BACKEND_URL}/api/anthropic`
  : 'http://localhost:3001/api/anthropic'

// Model abstraction: Default model can be configured via env var, allowing backend to control model selection
// Frontend can still pass model in request, but backend can override if needed
const DEFAULT_MODEL = import.meta.env.VITE_AI_MODEL || 'claude-sonnet-4-5-20250929'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_TEMPERATURE = 0.7
const REQUEST_TIMEOUT = 60000 // 60 seconds
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 1000 // 1 second base delay

// API key is handled by backend - no longer needed in frontend

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
  return RETRY_DELAY_BASE * Math.pow(2, attempt)
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: ClaudeError): boolean {
  return error.retryable && (
    error.type === 'network_error' ||
    error.type === 'timeout' ||
    error.type === 'rate_limit' ||
    (error.type === 'api_error' && error.statusCode && error.statusCode >= 500)
  )
}

/**
 * Parse API error response
 */
function parseError(error: any, statusCode?: number): ClaudeError {
  if (error.type) {
    return error as ClaudeError
  }

  // Network/timeout errors
  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    return {
      type: 'timeout',
      message: 'Request timed out. Please try again.',
      retryable: true
    }
  }

  if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
    return {
      type: 'network_error',
      message: 'Network error. Please check your connection.',
      retryable: true
    }
  }

  // API errors
  if (statusCode === 401) {
    return {
      type: 'invalid_key',
      message: 'Authentication failed. Please check backend API key configuration.',
      statusCode: 401,
      retryable: false
    }
  }

  if (statusCode === 429) {
    return {
      type: 'rate_limit',
      message: 'Rate limit exceeded. Please wait a moment and try again.',
      statusCode: 429,
      retryable: true
    }
  }

  if (statusCode && statusCode >= 500) {
    return {
      type: 'api_error',
      message: `API error (${statusCode}). Please try again.`,
      statusCode,
      retryable: true
    }
  }

  // Unknown error
  return {
    type: 'unknown',
    message: error.message || 'An unknown error occurred',
    statusCode,
    retryable: false
  }
}

/**
 * Send message to Claude API with retry logic
 */
export async function sendMessage(
  options: ClaudeRequestOptions
): Promise<ClaudeResponse> {
  // Model abstraction: Use provided model, fallback to env-configured default, or hardcoded default
  // Backend can override this by not passing model in request, allowing backend to control model selection
  const model = options.model || DEFAULT_MODEL
  const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE

  // Prepare messages (system message is separate in Anthropic API)
  const messages = options.messages.filter(msg => msg.role !== 'system')
  const systemMessage = options.messages.find(msg => msg.role === 'system')?.content || options.system

  const requestBody = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role, // Anthropic doesn't support system role in messages array
      content: msg.content
    })),
    ...(systemMessage && { system: systemMessage })
  }

  let lastError: ClaudeError | null = null

  // Retry loop
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

      const response = await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // API key and anthropic-version are handled by backend
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const error = parseError(errorData, response.status)
        
        // If not retryable or last attempt, throw
        if (!isRetryableError(error) || attempt === MAX_RETRIES) {
          throw error
        }
        
        lastError = error
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, getRetryDelay(attempt)))
        continue
      }

      // Parse successful response
      const data = await response.json()
      
      // Backend returns content as a string (already extracted from Anthropic response)
      // Format: { content: string, usage?: { inputTokens: number, outputTokens: number } }
      const content = data.content || ''

      return {
        content,
        usage: data.usage ? {
          inputTokens: data.usage.inputTokens || 0,
          outputTokens: data.usage.outputTokens || 0
        } : undefined
      }

    } catch (error: any) {
      const claudeError = parseError(error)
      
      // If not retryable or last attempt, throw
      if (!isRetryableError(claudeError) || attempt === MAX_RETRIES) {
        return {
          content: '',
          error: claudeError.message
        }
      }
      
      lastError = claudeError
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, getRetryDelay(attempt)))
    }
  }

  // If we get here, all retries failed
  return {
    content: '',
    error: lastError?.message || 'Failed to get response from Claude API'
  }
}

/**
 * Validate backend connection (quick check)
 * Note: API key validation is handled by backend
 */
export async function validateBackendConnection(): Promise<boolean> {
  try {
    // Try a minimal request to validate backend connection
    const response = await sendMessage({
      messages: [{ role: 'user', content: 'test' }],
      maxTokens: 10
    })
    return !response.error
  } catch {
    return false
  }
}

