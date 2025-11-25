/**
 * Error Handler
 * 
 * Centralized error handling with user-friendly messages
 */

export interface AIError {
  code: string
  message: string
  userMessage: string
  retryable: boolean
  details?: any
}

export type ErrorCode =
  | 'API_KEY_MISSING'
  | 'API_KEY_INVALID'
  | 'API_RATE_LIMIT'
  | 'API_TIMEOUT'
  | 'API_NETWORK_ERROR'
  | 'API_SERVER_ERROR'
  | 'TOKEN_LIMIT_EXCEEDED'
  | 'INVALID_RESPONSE'
  | 'NODE_GENERATION_FAILED'
  | 'POSITION_CONFLICT'
  | 'INVALID_NODE_REFERENCE'
  | 'EMPTY_CANVAS'
  | 'UNKNOWN_ERROR'

/**
 * Create user-friendly error messages
 */
export function createAIError(
  code: ErrorCode,
  details?: any
): AIError {
  const errorMap: Record<ErrorCode, { message: string; userMessage: string; retryable: boolean }> = {
    API_KEY_MISSING: {
      message: 'Backend API key is missing',
      userMessage: 'Backend API key not configured. Please check backend server configuration.',
      retryable: false
    },
    API_KEY_INVALID: {
      message: 'Invalid backend API key',
      userMessage: 'Backend authentication failed. Please check backend API key configuration.',
      retryable: false
    },
    API_RATE_LIMIT: {
      message: 'API rate limit exceeded',
      userMessage: 'Too many requests. Please wait a moment and try again.',
      retryable: true
    },
    API_TIMEOUT: {
      message: 'API request timed out',
      userMessage: 'Request took too long. Please try again.',
      retryable: true
    },
    API_NETWORK_ERROR: {
      message: 'Network error',
      userMessage: 'Network connection issue. Please check your internet connection and try again.',
      retryable: true
    },
    API_SERVER_ERROR: {
      message: 'API server error',
      userMessage: 'The AI service is temporarily unavailable. Please try again in a moment.',
      retryable: true
    },
    TOKEN_LIMIT_EXCEEDED: {
      message: 'Token limit exceeded',
      userMessage: 'The canvas is too large to process. Try reducing the number of nodes or clearing some messages.',
      retryable: false
    },
    INVALID_RESPONSE: {
      message: 'Invalid AI response format',
      userMessage: 'The AI response was not in the expected format. Please try rephrasing your request.',
      retryable: true
    },
    NODE_GENERATION_FAILED: {
      message: 'Failed to generate nodes',
      userMessage: 'Could not create the requested nodes. Please check the node references and try again.',
      retryable: true
    },
    POSITION_CONFLICT: {
      message: 'Position conflict detected',
      userMessage: 'Some nodes could not be placed due to position conflicts. They have been automatically adjusted.',
      retryable: false
    },
    INVALID_NODE_REFERENCE: {
      message: 'Invalid node reference',
      userMessage: details?.reference
        ? `Could not find node "${details.reference}". Please check the node name and try again.`
        : 'Invalid node reference. Please check the node names and try again.',
      retryable: false
    },
    EMPTY_CANVAS: {
      message: 'Canvas is empty',
      userMessage: 'The canvas is empty. Add some nodes first before asking about relationships.',
      retryable: false
    },
    UNKNOWN_ERROR: {
      message: details?.message || 'Unknown error occurred',
      userMessage: 'An unexpected error occurred. Please try again or contact support if the issue persists.',
      retryable: true
    }
  }

  const error = errorMap[code] || errorMap.UNKNOWN_ERROR

  return {
    code,
    message: error.message,
    userMessage: error.userMessage,
    retryable: error.retryable,
    details
  }
}

/**
 * Convert Claude API error to AIError
 */
export function convertClaudeError(claudeError: any): AIError {
  if (claudeError.type === 'invalid_key') {
    return createAIError('API_KEY_INVALID')
  }
  if (claudeError.type === 'rate_limit') {
    return createAIError('API_RATE_LIMIT')
  }
  if (claudeError.type === 'timeout') {
    return createAIError('API_TIMEOUT')
  }
  if (claudeError.type === 'network_error') {
    return createAIError('API_NETWORK_ERROR')
  }
  if (claudeError.type === 'api_error' && claudeError.statusCode && claudeError.statusCode >= 500) {
    return createAIError('API_SERVER_ERROR')
  }
  
  return createAIError('UNKNOWN_ERROR', { message: claudeError.message })
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: AIError): boolean {
  return error.retryable
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(error: AIError): string {
  return `[${error.code}] ${error.message}${error.details ? ` - ${JSON.stringify(error.details)}` : ''}`
}



