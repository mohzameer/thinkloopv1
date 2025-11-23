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
const API_BASE_URL = 'https://api.anthropic.com/v1'
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_TEMPERATURE = 0.7
const REQUEST_TIMEOUT = 60000 // 60 seconds
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 1000 // 1 second base delay

/**
 * Get API key from environment
 */
function getApiKey(): string {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('VITE_ANTHROPIC_API_KEY is not set in environment variables')
  }
  return apiKey
}

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
      message: 'Invalid API key. Please check your VITE_ANTHROPIC_API_KEY.',
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
  const apiKey = getApiKey()
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
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
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
      
      // Extract content from response
      // Anthropic API returns content as array of text blocks
      const content = data.content
        ?.map((block: any) => block.text || block.content || '')
        .join('') || ''

      return {
        content,
        usage: data.usage ? {
          inputTokens: data.usage.input_tokens || 0,
          outputTokens: data.usage.output_tokens || 0
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
 * Validate API key (quick check)
 */
export async function validateApiKey(): Promise<boolean> {
  try {
    const apiKey = getApiKey()
    // Try a minimal request to validate the key
    const response = await sendMessage({
      messages: [{ role: 'user', content: 'test' }],
      maxTokens: 10
    })
    return !response.error
  } catch {
    return false
  }
}

