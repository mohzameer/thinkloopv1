/**
 * AI Service
 * 
 * Provider-agnostic AI API service
 * Backend handles routing to different providers (Anthropic, OpenAI, DeepSeek, etc.)
 */

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIRequestOptions {
  system?: string
  messages: AIMessage[]
  maxTokens?: number
  temperature?: number
  model?: string
  provider?: string // Optional: hint for backend provider selection
}

export interface AIResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  error?: string
  provider?: string // Optional: which provider was used
}

export interface AIError {
  type: 'api_error' | 'network_error' | 'timeout' | 'invalid_key' | 'rate_limit' | 'unknown'
  message: string
  statusCode?: number
  retryable: boolean
}

// API Configuration
// Backend API URL - backend handles CORS, API key authentication, and provider routing
function getApiBaseUrl(): string {
  const backendUrl = import.meta.env.VITE_BACKEND_URL

  if (!backendUrl) {
    // Default to localhost:3001 for development
    return 'http://localhost:3001/api/ai'
  }

  // Handle cases where URL might already include /api/ai or have trailing slash
  const cleanUrl = backendUrl.trim().replace(/\/+$/, '') // Remove trailing slashes

  // If URL already includes /api/ai, use it as-is
  if (cleanUrl.includes('/api/ai')) {
    return cleanUrl
  }

  // Otherwise append /api/ai
  return `${cleanUrl}/api/ai`
}

const API_BASE_URL = getApiBaseUrl()

// Model abstraction: Default model can be configured via env var, allowing backend to control model selection
// Backend can route to different providers based on model name or configuration
const DEFAULT_MODEL = import.meta.env.VITE_AI_MODEL || 'claude-sonnet-4-5-20250929'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_TEMPERATURE = 0.7
const REQUEST_TIMEOUT = 60000 // 60 seconds
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 1000 // 1 second base delay

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
  return RETRY_DELAY_BASE * Math.pow(2, attempt)
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: AIError): boolean {
  return Boolean(error.retryable && (
    error.type === 'network_error' ||
    error.type === 'timeout' ||
    error.type === 'rate_limit' ||
    (error.type === 'api_error' && error.statusCode && error.statusCode >= 500)
  ))
}

/**
 * Parse API error response
 */
function parseError(error: any, statusCode?: number): AIError {
  if (error.type) {
    return error as AIError
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
 * Send message to AI API with retry logic
 * Provider-agnostic: backend handles routing to appropriate provider
 */
export async function sendMessage(
  options: AIRequestOptions
): Promise<AIResponse> {
  // Model abstraction: Use provided model, fallback to env-configured default, or hardcoded default
  // Backend can override this and route to different providers based on model name or configuration
  const model = options.model || DEFAULT_MODEL
  const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE

  // Prepare messages - backend handles provider-specific formatting
  const messages = options.messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }))

  const requestBody = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages,
    ...(options.system && { system: options.system }),
    ...(options.provider && { provider: options.provider }) // Optional provider hint
  }

  let lastError: AIError | null = null

  // Retry loop
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

      const url = `${API_BASE_URL}/messages`

      // Debug logging in development
      if (import.meta.env.DEV) {
        console.log('[AI Service] Sending request to:', url)
        console.log('[AI Service] Request body:', { ...requestBody, messages: `[${requestBody.messages.length} messages]` })
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // API keys and provider-specific headers are handled by backend
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })

      if (import.meta.env.DEV) {
        console.log('[AI Service] Response status:', response.status, response.statusText)
      }

      clearTimeout(timeoutId)

      if (import.meta.env.DEV) {
        console.log('[AI Service] Response status:', response.status, response.statusText)
      }

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        if (import.meta.env.DEV) {
          console.error('[AI Service] Error response:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          })
        }

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

      if (import.meta.env.DEV) {
        console.log('[AI Service] Response data:', {
          hasContent: !!data.content,
          contentLength: data.content?.length || 0,
          provider: data.provider,
          usage: data.usage
        })
      }

      // Backend returns standardized response format regardless of provider
      // Format: { content: string, usage?: { inputTokens: number, outputTokens: number }, provider?: string }
      const content = data.content || ''

      return {
        content,
        usage: data.usage ? {
          inputTokens: data.usage.inputTokens || 0,
          outputTokens: data.usage.outputTokens || 0
        } : undefined,
        provider: data.provider // Optional: which provider was used
      }

    } catch (error: any) {
      const aiError = parseError(error)

      // If not retryable or last attempt, throw
      if (!isRetryableError(aiError) || attempt === MAX_RETRIES) {
        return {
          content: '',
          error: aiError.message
        }
      }

      lastError = aiError
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, getRetryDelay(attempt)))
    }
  }

  // If we get here, all retries failed
  return {
    content: '',
    error: lastError?.message || 'Failed to get response from AI API'
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

// Re-export types for backward compatibility (if needed during migration)
export type ClaudeMessage = AIMessage
export type ClaudeRequestOptions = AIRequestOptions
export type ClaudeResponse = AIResponse
export type ClaudeError = AIError

