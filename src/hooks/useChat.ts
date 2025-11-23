import { useState, useEffect, useCallback } from 'react'
import { 
  getSubItemMessages, 
  createMessage as createMessageInDb, 
  updateMessage as updateMessageInDb, 
  deleteMessage as deleteMessageInDb 
} from '../firebase/database'
import type { Timestamp } from 'firebase/firestore'
import type { Node, Edge } from '@xyflow/react'
import { sendMessage as sendClaudeMessage } from '../services/ai/claudeService'
import { buildPrompt } from '../services/ai/promptBuilder'
import { parseAIResponse, isAddResponse, isAnswerResponse, isClarifyResponse, isErrorResponse } from '../services/ai/responseParser'
import { classifyIntent } from '../services/ai/intentClassifier'
import { extractCanvasContext } from '../services/ai/contextExtractor'
import { manageContext, type ContextWarning } from '../services/ai/contextManager'
import type { AIResponse } from '../services/ai/responseParser'
import { convertClaudeError, createAIError, formatErrorForLogging, type AIError } from '../services/ai/errorHandler'
import type { Intent } from '../services/ai/intentClassifier'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
  updatedAt: Date
}

export interface AIResponseData {
  response: AIResponse
  nodes?: Node[]
  edges?: Edge[]
}

export interface ClarificationState {
  isPending: boolean
  questions: string[]
  context: string
  originalIntent: Intent
  originalMessage: string
  clarificationAnswers: Record<number, string> // question index -> answer
}

interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  isAIProcessing: boolean
  error: string | null
  contextWarning: ContextWarning | null
  clarificationState: ClarificationState | null
  sendMessage: (content: string) => Promise<{ messageId: string | null; aiResponse?: AIResponseData }>
  answerClarification: (questionIndex: number, answer: string) => Promise<AIResponseData | null>
  cancelClarification: () => void
  updateMessage: (id: string, content: string) => Promise<boolean>
  deleteMessage: (id: string) => Promise<boolean>
  refresh: () => Promise<void>
}

/**
 * Hook to manage chat messages for a specific sub-item (variation)
 * Now includes AI integration for generating responses
 */
export const useChat = (
  fileId: string | null,
  mainItemId: string | null,
  subItemId: string | null,
  options?: {
    nodes?: Node[]
    edges?: Edge[]
    selectedNodeIds?: string[]
    enableAI?: boolean
  }
): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAIProcessing, setIsAIProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contextWarning, setContextWarning] = useState<ContextWarning | null>(null)
  const [clarificationState, setClarificationState] = useState<ClarificationState | null>(null)

  const nodes = options?.nodes || []
  const edges = options?.edges || []
  const selectedNodeIds = options?.selectedNodeIds || []
  const enableAI = options?.enableAI !== false // Default to true

  // Convert Firestore message to app message
  const convertMessage = useCallback((firestoreMessage: { id: string; data: any }): ChatMessage => {
    const data = firestoreMessage.data
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
    const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date()
    
    return {
      id: firestoreMessage.id,
      role: data.role || 'user',
      content: data.content || '',
      createdAt,
      updatedAt
    }
  }, [])

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!fileId || !mainItemId || !subItemId) {
      setMessages([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      console.log('[useChat] Loading messages for:', { fileId, mainItemId, subItemId })
      
      const firestoreMessages = await getSubItemMessages(fileId, mainItemId, subItemId)
      const convertedMessages = firestoreMessages.map(convertMessage)
      
      console.log('[useChat] Loaded', convertedMessages.length, 'messages')
      setMessages(convertedMessages)
    } catch (err: any) {
      console.error('[useChat] Error loading messages:', err)
      setError(err.message || 'Failed to load messages')
      setMessages([])
    } finally {
      setIsLoading(false)
    }
  }, [fileId, mainItemId, subItemId, convertMessage])

  // Initial load and reload on change
  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // Send message (user message) and generate AI response
  const sendMessage = useCallback(async (content: string): Promise<{ messageId: string | null; aiResponse?: AIResponseData }> => {
    if (!fileId || !mainItemId || !subItemId) {
      return { messageId: null }
    }

    if (!content.trim()) {
      return { messageId: null }
    }

    try {
      console.log('[useChat] Sending message:', { content })
      
      // Save user message to database
      const messageId = await createMessageInDb(fileId, mainItemId, subItemId, 'user', content.trim())
      
      // Reload messages to get the new one with proper timestamps
      await loadMessages()

      // Generate AI response if enabled
      let aiResponse: AIResponseData | undefined
      if (enableAI) {
        try {
          setIsAIProcessing(true)
          setError(null)
          setContextWarning(null)

          // Classify intent
          const classification = classifyIntent(content, {
            previousIntent: undefined // Could track this in state
          })

          // Extract canvas context
          const canvasContext = extractCanvasContext(nodes, edges, {
            includePositions: true,
            includeTags: true,
            includeGraphAnalysis: true,
            selectedNodeIds
          })

          // Prepare conversation history (last 15 messages)
          const conversationHistory = messages.slice(-15).map(msg => ({
            role: msg.role,
            content: msg.content
          }))

          // Manage context (truncate if needed)
          const contextResult = manageContext({
            systemPrompt: '', // Will be added by buildPrompt
            messages: conversationHistory,
            nodes,
            edges,
            selectedNodeIds
          })

          // Set context warning if any
          if (contextResult.warning) {
            setContextWarning(contextResult.warning)
          }

          // Build prompt
          const { systemPrompt, messages: promptMessages } = buildPrompt({
            intent: classification.intent,
            canvasContext: contextResult.canvasContext,
            conversationHistory: contextResult.messages,
            userMessage: content.trim()
          })

          // Call Claude API
          const claudeResponse = await sendClaudeMessage({
            system: systemPrompt,
            messages: promptMessages,
            maxTokens: 4096,
            temperature: 0.7
          })

          if (claudeResponse.error) {
            // Convert Claude error to AIError for better handling
            const aiError = convertClaudeError({ type: 'unknown', message: claudeResponse.error })
            console.error('[useChat] Claude API error:', formatErrorForLogging(aiError))
            throw new Error(aiError.userMessage)
          }

          // Parse AI response
          const parsedResponse = parseAIResponse(claudeResponse.content)

          // Handle different response types
          if (isAddResponse(parsedResponse)) {
            // For ADD responses, we'll return the data for parent to handle
            // The nodes/edges will be generated in CanvasPage
            aiResponse = {
              response: parsedResponse
            }
          } else if (isAnswerResponse(parsedResponse)) {
            // Save as assistant message
            await createMessageInDb(
              fileId,
              mainItemId,
              subItemId,
              'assistant',
              parsedResponse.response
            )
            
            // Reload messages
            await loadMessages()
          } else if (isClarifyResponse(parsedResponse)) {
            // Set clarification state
            setClarificationState({
              isPending: true,
              questions: parsedResponse.questions,
              context: parsedResponse.context,
              originalIntent: classification.intent,
              originalMessage: content.trim(),
              clarificationAnswers: {}
            })

            // Save clarification message
            await createMessageInDb(
              fileId,
              mainItemId,
              subItemId,
              'assistant',
              `I need some clarification:\n\n${parsedResponse.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n${parsedResponse.context}`
            )
            
            // Reload messages
            await loadMessages()
          } else if (isErrorResponse(parsedResponse)) {
            // Save error as assistant message
            await createMessageInDb(
              fileId,
              mainItemId,
              subItemId,
              'assistant',
              `I encountered an error: ${parsedResponse.message}`
            )
            
            await loadMessages()
            setError(parsedResponse.message)
          }

        } catch (aiError: any) {
          console.error('[useChat] Error generating AI response:', aiError)
          
          // Create user-friendly error message
          let errorMessage = 'Failed to generate AI response'
          if (aiError.message) {
            errorMessage = aiError.message
          } else if (aiError.code) {
            const aiErrorObj = createAIError(aiError.code as any, aiError.details)
            errorMessage = aiErrorObj.userMessage
          }
          
          setError(errorMessage)
          
          // Save error message with user-friendly text
          try {
            await createMessageInDb(
              fileId,
              mainItemId,
              subItemId,
              'assistant',
              `I'm sorry, I encountered an error: ${errorMessage}. Please try again or rephrase your request.`
            )
            await loadMessages()
          } catch (saveError) {
            console.error('[useChat] Error saving error message:', saveError)
          }
        } finally {
          setIsAIProcessing(false)
        }
      }
      
      return { messageId, aiResponse }
    } catch (err: any) {
      console.error('[useChat] Error sending message:', err)
      setError(err.message || 'Failed to send message')
      return { messageId: null }
    }
  }, [fileId, mainItemId, subItemId, loadMessages, enableAI, nodes, edges, selectedNodeIds, messages])

  // Answer a clarification question and resume if all answered
  const answerClarification = useCallback(async (questionIndex: number, answer: string): Promise<AIResponseData | null> => {
    if (!clarificationState || !fileId || !mainItemId || !subItemId) {
      return null
    }

    // Update clarification answers
    const updatedAnswers = {
      ...clarificationState.clarificationAnswers,
      [questionIndex]: answer.trim()
    }

    const updatedState = {
      ...clarificationState,
      clarificationAnswers: updatedAnswers
    }

    setClarificationState(updatedState)

    // Save user answer as message
    await createMessageInDb(
      fileId,
      mainItemId,
      subItemId,
      'user',
      `Answer to question ${questionIndex + 1}: ${answer.trim()}`
    )

    await loadMessages()

    // Check if all questions are answered
    const allAnswered = clarificationState.questions.every((_, idx) => updatedAnswers[idx] !== undefined)

    if (allAnswered) {
      // Resume original request with clarification answers
      setIsAIProcessing(true)
      setError(null)
      setContextWarning(null)

      try {
        // Build clarification context
        const clarificationContext = clarificationState.questions
          .map((q, idx) => `Q${idx + 1}: ${q}\nA${idx + 1}: ${updatedAnswers[idx]}`)
          .join('\n\n')

        // Combine original message with clarification answers
        const resumedMessage = `${clarificationState.originalMessage}\n\n[Clarification Answers]\n${clarificationContext}`

        // Classify intent (use original intent)
        const classification = {
          intent: clarificationState.originalIntent,
          confidence: 1.0
        }

        // Extract canvas context
        const canvasContext = extractCanvasContext(nodes, edges, {
          includePositions: true,
          includeTags: true,
          includeGraphAnalysis: true,
          selectedNodeIds
        })

        // Prepare conversation history
        const conversationHistory = messages.slice(-15).map(msg => ({
          role: msg.role,
          content: msg.content
        }))

        // Manage context
        const contextResult = manageContext({
          systemPrompt: '',
          messages: conversationHistory,
          nodes,
          edges,
          selectedNodeIds
        })

        if (contextResult.warning) {
          setContextWarning(contextResult.warning)
        }

        // Build prompt with clarification context
        const { systemPrompt, messages: promptMessages } = buildPrompt({
          intent: classification.intent,
          canvasContext: contextResult.canvasContext,
          conversationHistory: contextResult.messages,
          userMessage: resumedMessage
        })

        // Call Claude API
        const claudeResponse = await sendClaudeMessage({
          system: systemPrompt,
          messages: promptMessages,
          maxTokens: 4096,
          temperature: 0.7
        })

        if (claudeResponse.error) {
          const aiError = convertClaudeError({ type: 'unknown', message: claudeResponse.error })
          console.error('[useChat] Claude API error:', formatErrorForLogging(aiError))
          throw new Error(aiError.userMessage)
        }

        // Parse AI response
        const parsedResponse = parseAIResponse(claudeResponse.content)

        // Handle response (same as sendMessage)
        if (isAddResponse(parsedResponse)) {
          // Return for parent to handle
          setClarificationState(null)
          return {
            response: parsedResponse
          }
        } else if (isAnswerResponse(parsedResponse)) {
          await createMessageInDb(
            fileId,
            mainItemId,
            subItemId,
            'assistant',
            parsedResponse.response
          )
          await loadMessages()
        } else if (isClarifyResponse(parsedResponse)) {
          // Another clarification needed
          setClarificationState({
            isPending: true,
            questions: parsedResponse.questions,
            context: parsedResponse.context,
            originalIntent: clarificationState.originalIntent,
            originalMessage: clarificationState.originalMessage,
            clarificationAnswers: {}
          })
          await createMessageInDb(
            fileId,
            mainItemId,
            subItemId,
            'assistant',
            `I need additional clarification:\n\n${parsedResponse.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n${parsedResponse.context}`
          )
          await loadMessages()
        }

        // Clear clarification state if not another clarification
        if (!isClarifyResponse(parsedResponse)) {
          setClarificationState(null)
        }
        
        return null
      } catch (error: any) {
        console.error('[useChat] Error resuming after clarification:', error)
        setError(error.message || 'Failed to process clarification')
        setClarificationState(null)
        return null
      } finally {
        setIsAIProcessing(false)
      }
    }
    
    return null
  }, [clarificationState, fileId, mainItemId, subItemId, loadMessages, nodes, edges, selectedNodeIds, messages])

  // Cancel clarification
  const cancelClarification = useCallback(() => {
    setClarificationState(null)
  }, [])

  // Update message content
  const updateMessage = useCallback(async (id: string, content: string): Promise<boolean> => {
    if (!fileId || !mainItemId || !subItemId) {
      return false
    }

    try {
      console.log('[useChat] Updating message:', id)
      await updateMessageInDb(fileId, mainItemId, subItemId, id, content)
      
      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === id ? { ...msg, content, updatedAt: new Date() } : msg
      ))
      
      return true
    } catch (err: any) {
      console.error('[useChat] Error updating message:', err)
      setError(err.message || 'Failed to update message')
      return false
    }
  }, [fileId, mainItemId, subItemId])

  // Delete message
  const deleteMessage = useCallback(async (id: string): Promise<boolean> => {
    if (!fileId || !mainItemId || !subItemId) {
      return false
    }

    try {
      console.log('[useChat] Deleting message:', id)
      await deleteMessageInDb(fileId, mainItemId, subItemId, id)
      
      // Update local state
      setMessages(prev => prev.filter(msg => msg.id !== id))
      
      return true
    } catch (err: any) {
      console.error('[useChat] Error deleting message:', err)
      setError(err.message || 'Failed to delete message')
      return false
    }
  }, [fileId, mainItemId, subItemId])

  return {
    messages,
    isLoading,
    isAIProcessing,
    error,
    contextWarning,
    clarificationState,
    sendMessage,
    answerClarification,
    cancelClarification,
    updateMessage,
    deleteMessage,
    refresh: loadMessages
  }
}

