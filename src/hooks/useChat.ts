import { useState, useEffect, useCallback } from 'react'
import { 
  getFileMessages, 
  createFileMessage as createMessageInDb, 
  updateFileMessage as updateMessageInDb, 
  deleteFileMessage as deleteMessageInDb 
} from '../firebase/database'
import type { Timestamp } from 'firebase/firestore'
import type { Node, Edge } from '@xyflow/react'
import { sendMessage as sendAIMessage } from '../services/ai/aiService'
import { buildPrompt } from '../services/ai/promptBuilder'
import { parseAIResponse, isAddResponse, isUpdateResponse, isAnswerResponse, isClarifyResponse, isErrorResponse, isComplexityWarningResponse } from '../services/ai/responseParser'
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
 * Hook to manage chat messages for a specific file
 * Now includes AI integration for generating responses
 */
export const useChat = (
  fileId: string | null,
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
  
  // Step tracking for simulations
  const [simulationStepCount, setSimulationStepCount] = useState(0)

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
    if (!fileId) {
      setMessages([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      console.log('[useChat] Loading messages for file:', fileId)
      
      const firestoreMessages = await getFileMessages(fileId)
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
  }, [fileId, convertMessage])

  // Initial load and reload on change
  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // Send message (user message) and generate AI response
  const sendMessage = useCallback(async (content: string): Promise<{ messageId: string | null; aiResponse?: AIResponseData }> => {
    if (!fileId) {
      return { messageId: null }
    }

    if (!content.trim()) {
      return { messageId: null }
    }

    try {
      console.log('[useChat] Sending message:', { content })
      
      // Save user message to database
      const messageId = await createMessageInDb(fileId, 'user', content.trim())
      
      // Optimistically add user message to UI (don't reload yet to avoid resetting screen)
      setMessages(prev => [...prev, {
        id: messageId || `temp-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        createdAt: new Date(),
        updatedAt: new Date()
      }])
      
      // Reload messages in background to get proper timestamps (but don't wait)
      loadMessages().catch(err => console.error('[useChat] Error reloading messages:', err))

      // Generate AI response if enabled
      let aiResponse: AIResponseData | undefined
      if (enableAI) {
        try {
          setIsAIProcessing(true)
          setError(null)
          setContextWarning(null)

          // Performance monitoring: track start time
          const processingStartTime = performance.now()
          const MAX_PROCESSING_TIME = 30000 // 30 seconds

          // Check if user explicitly asked for more than 5 nodes or more simulation steps
          const userExplicitlyRequestedComplex = 
            content.toLowerCase().includes('proceed') ||
            content.toLowerCase().includes('continue') ||
            content.toLowerCase().includes('all nodes') ||
            content.toLowerCase().includes('more than 5') ||
            content.toLowerCase().includes('complex') ||
            content.toLowerCase().includes('full')

          // Classify intent
          const classification = classifyIntent(content, {
            previousIntent: undefined // Could track this in state
          })

          // Track simulation steps
          if (classification.intent === 'SIMULATE') {
            const newStepCount = simulationStepCount + 1
            setSimulationStepCount(newStepCount)
            
            // Check if simulation steps exceed limit (unless explicitly requested)
            if (newStepCount > 5 && !userExplicitlyRequestedComplex) {
              const warningMessage = `Simulation has reached ${newStepCount} steps, which exceeds the recommended limit of 5. The simulation is getting complex. Please break it down into smaller steps or explicitly request to continue.`
              
              const warningMessageId = await createMessageInDb(
                fileId,
                'assistant',
                warningMessage
              )
              
              setMessages(prev => [...prev, {
                id: warningMessageId || `temp-${Date.now()}`,
                role: 'assistant',
                content: warningMessage,
                createdAt: new Date(),
                updatedAt: new Date()
              }])
              
              setError('Simulation step limit reached')
              setIsAIProcessing(false)
              loadMessages().catch(err => console.error('[useChat] Error reloading messages:', err))
              return { messageId }
            }
          } else {
            // Reset simulation step count if not simulating
            setSimulationStepCount(0)
          }

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

          // Performance check: if processing is taking too long, abort
          const elapsedTime = performance.now() - processingStartTime
          if (elapsedTime > MAX_PROCESSING_TIME) {
            throw new Error('Processing is taking too long. The request is too complex. Please try breaking it down into smaller steps.')
          }

          // Call Claude API with timeout protection
          const apiCallPromise = sendAIMessage({
            system: systemPrompt,
            messages: promptMessages,
            maxTokens: 4096,
            temperature: 0.7
          })

          // Add timeout wrapper
          const timeoutPromise = new Promise<Awaited<ReturnType<typeof sendAIMessage>>>((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout: Processing took too long. The request may be too complex.')), MAX_PROCESSING_TIME - elapsedTime)
          })

          const claudeResponse = await Promise.race([apiCallPromise, timeoutPromise])

          if (claudeResponse.error) {
            // Convert Claude error to AIError for better handling
            const aiError = convertClaudeError({ type: 'unknown', message: claudeResponse.error })
            console.error('[useChat] Claude API error:', formatErrorForLogging(aiError))
            throw new Error(aiError.userMessage)
          }

          // Performance check: final check before parsing
          const totalElapsedTime = performance.now() - processingStartTime
          if (totalElapsedTime > MAX_PROCESSING_TIME) {
            throw new Error('Processing exceeded time limit. The request is too complex. Please try breaking it down into smaller steps.')
          }

          // Parse AI response
          const parsedResponse = parseAIResponse(claudeResponse.content)

          // Handle different response types
          if (isComplexityWarningResponse(parsedResponse)) {
            // Handle complexity warning
            const complexityMessage = parsedResponse.message
            
            const complexityMessageId = await createMessageInDb(
              fileId,
              'assistant',
              complexityMessage
            )
            
            setMessages(prev => [...prev, {
              id: complexityMessageId || `temp-${Date.now()}`,
              role: 'assistant',
              content: complexityMessage,
              createdAt: new Date(),
              updatedAt: new Date()
            }])
            
            setError('Complex scenario detected')
            loadMessages().catch(err => console.error('[useChat] Error reloading messages:', err))
          } else if (isAddResponse(parsedResponse)) {
            // For ADD responses, we'll return the data for parent to handle
            // The nodes/edges will be generated in CanvasPage
            aiResponse = {
              response: parsedResponse
            }
          } else if (isUpdateResponse(parsedResponse)) {
            // For UPDATE responses, we'll return the data for parent to handle
            // The node updates will be applied in CanvasPage with user permission
            aiResponse = {
              response: parsedResponse
            }
          } else if (isAnswerResponse(parsedResponse)) {
            // Save as assistant message
            const assistantMessageId = await createMessageInDb(
              fileId,
              'assistant',
              parsedResponse.response
            )
            
            // Optimistically add assistant message to UI (replaces loading state)
            setMessages(prev => [...prev, {
              id: assistantMessageId || `temp-${Date.now()}`,
              role: 'assistant',
              content: parsedResponse.response,
              createdAt: new Date(),
              updatedAt: new Date()
            }])
            
            // Reload messages in background to get proper timestamps
            loadMessages().catch(err => console.error('[useChat] Error reloading messages:', err))
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
            const clarificationMessageId = await createMessageInDb(
              fileId,
              'assistant',
              `I need some clarification:\n\n${parsedResponse.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n${parsedResponse.context}`
            )
            
            // Optimistically add clarification message to UI
            setMessages(prev => [...prev, {
              id: clarificationMessageId || `temp-${Date.now()}`,
              role: 'assistant',
              content: `I need some clarification:\n\n${parsedResponse.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n${parsedResponse.context}`,
              createdAt: new Date(),
              updatedAt: new Date()
            }])
            
            // Reload messages in background
            loadMessages().catch(err => console.error('[useChat] Error reloading messages:', err))
          } else if (isErrorResponse(parsedResponse)) {
            // Save error as assistant message
            const errorMessageId = await createMessageInDb(
              fileId,
              'assistant',
              `I encountered an error: ${parsedResponse.message}`
            )
            
            // Optimistically add error message to UI
            setMessages(prev => [...prev, {
              id: errorMessageId || `temp-${Date.now()}`,
              role: 'assistant',
              content: `I encountered an error: ${parsedResponse.message}`,
              createdAt: new Date(),
              updatedAt: new Date()
            }])
            
            setError(parsedResponse.message)
            
            // Reload messages in background
            loadMessages().catch(err => console.error('[useChat] Error reloading messages:', err))
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
            const errorMessageId = await createMessageInDb(
              fileId,
              'assistant',
              `I'm sorry, I encountered an error: ${errorMessage}. Please try again or rephrase your request.`
            )
            
            // Optimistically add error message to UI
            setMessages(prev => [...prev, {
              id: errorMessageId || `temp-${Date.now()}`,
              role: 'assistant',
              content: `I'm sorry, I encountered an error: ${errorMessage}. Please try again or rephrase your request.`,
              createdAt: new Date(),
              updatedAt: new Date()
            }])
            
            // Reload messages in background
            loadMessages().catch(err => console.error('[useChat] Error reloading messages:', err))
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
  }, [fileId, loadMessages, enableAI, nodes, edges, selectedNodeIds, messages])

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

        // Performance monitoring for clarification flow
        const clarificationStartTime = performance.now()
        const MAX_PROCESSING_TIME = 30000 // 30 seconds

        // Call Claude API with timeout protection
        const apiCallPromise = sendAIMessage({
          system: systemPrompt,
          messages: promptMessages,
          maxTokens: 4096,
          temperature: 0.7
        })

        const timeoutPromise = new Promise<Awaited<ReturnType<typeof sendAIMessage>>>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout: Processing took too long. The request may be too complex.')), MAX_PROCESSING_TIME)
        })

        const claudeResponse = await Promise.race([apiCallPromise, timeoutPromise])

        // Performance check
        const clarificationElapsedTime = performance.now() - clarificationStartTime
        if (clarificationElapsedTime > MAX_PROCESSING_TIME) {
          throw new Error('Processing exceeded time limit. The request is too complex. Please try breaking it down into smaller steps.')
        }

        if (claudeResponse.error) {
          const aiError = convertClaudeError({ type: 'unknown', message: claudeResponse.error })
          console.error('[useChat] Claude API error:', formatErrorForLogging(aiError))
          throw new Error(aiError.userMessage)
        }

        // Parse AI response
        const parsedResponse = parseAIResponse(claudeResponse.content)

        // Handle response (same as sendMessage)
        if (isComplexityWarningResponse(parsedResponse)) {
          // Handle complexity warning in clarification flow
          const complexityMessage = parsedResponse.message
          await createMessageInDb(
            fileId,
            'assistant',
            complexityMessage
          )
          await loadMessages()
          setClarificationState(null)
          return null
        } else if (isAddResponse(parsedResponse)) {
          // Return for parent to handle
          setClarificationState(null)
          return {
            response: parsedResponse
          }
        } else if (isUpdateResponse(parsedResponse)) {
          // Return for parent to handle
          setClarificationState(null)
          return {
            response: parsedResponse
          }
        } else if (isAnswerResponse(parsedResponse)) {
          await createMessageInDb(
            fileId,
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
  }, [clarificationState, fileId, loadMessages, nodes, edges, selectedNodeIds, messages])

  // Cancel clarification
  const cancelClarification = useCallback(() => {
    setClarificationState(null)
  }, [])

  // Update message content
  const updateMessage = useCallback(async (id: string, content: string): Promise<boolean> => {
    if (!fileId) {
      return false
    }

    try {
      console.log('[useChat] Updating message:', id)
      await updateMessageInDb(fileId, id, content)
      
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
  }, [fileId])

  // Delete message
  const deleteMessage = useCallback(async (id: string): Promise<boolean> => {
    if (!fileId) {
      return false
    }

    try {
      console.log('[useChat] Deleting message:', id)
      await deleteMessageInDb(fileId, id)
      
      // Update local state
      setMessages(prev => prev.filter(msg => msg.id !== id))
      
      return true
    } catch (err: any) {
      console.error('[useChat] Error deleting message:', err)
      setError(err.message || 'Failed to delete message')
      return false
    }
  }, [fileId])

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

