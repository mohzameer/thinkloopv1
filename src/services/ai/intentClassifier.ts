/**
 * Intent Classifier
 * 
 * Classifies user messages to determine intent (ADD, QUERY, EXPLORE, etc.)
 * Uses keyword-based classification with context awareness
 */

import type { Intent } from './promptBuilder'

export interface ClassificationResult {
  intent: Intent
  confidence: number
  reasoning?: string
}

// Keyword patterns for each intent type
const INTENT_KEYWORDS: Record<Intent, string[]> = {
  ADD_NODES: [
    'add', 'create', 'new', 'insert', 'make', 'build', 'generate',
    'put', 'place', 'draw', 'add a', 'create a', 'new node',
    'add node', 'create node', 'insert node', 'add an', 'create an'
  ],
  QUERY_RELATIONSHIPS: [
    'how', 'what', 'related', 'connect', 'connection', 'relationship',
    'relate', 'link', 'linked', 'how are', 'what is the relationship',
    'how do', 'how does', 'related to', 'connected to', 'links to'
  ],
  EXPLORE_STRUCTURE: [
    'explain', 'describe', 'overview', 'summary', 'what does this',
    'what is this', 'tell me about', 'show me', 'what are',
    'explain the', 'describe the', 'what does', 'what is',
    'can you explain', 'can you describe'
  ],
  SIMULATE: [
    'simulate', 'what if', 'what happens', 'what would happen',
    'if', 'suppose', 'imagine', 'scenario', 'simulation',
    'what if we', 'what happens if', 'what would', 'predict'
  ],
  MODIFY: [
    'change', 'update', 'modify', 'edit', 'alter', 'adjust',
    'replace', 'remove', 'delete', 'rename', 'move',
    'change the', 'update the', 'modify the', 'edit the'
  ],
  CLARIFICATION_NEEDED: [], // Handled separately
  UNKNOWN: []
}

// Question words that suggest query/explore intents
const QUESTION_WORDS = ['how', 'what', 'why', 'when', 'where', 'who', 'which', 'can', 'could', 'would', 'should']

/**
 * Normalize text for matching (lowercase, remove punctuation)
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Calculate keyword match score for an intent
 */
function calculateKeywordScore(text: string, keywords: string[]): number {
  if (keywords.length === 0) return 0

  const normalized = normalizeText(text)
  let score = 0
  let matches = 0

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword)
    
    // Exact match gets highest score
    if (normalized === normalizedKeyword) {
      score += 10
      matches++
      continue
    }

    // Word boundary match (whole word)
    const wordBoundaryRegex = new RegExp(`\\b${normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (wordBoundaryRegex.test(normalized)) {
      score += 5
      matches++
      continue
    }

    // Substring match (partial)
    if (normalized.includes(normalizedKeyword)) {
      score += 2
      matches++
    }
  }

  // Normalize score (0-1 range)
  return Math.min(1, score / (keywords.length * 2))
}

/**
 * Check if message is a question
 */
function isQuestion(text: string): boolean {
  const normalized = normalizeText(text)
  const trimmed = normalized.trim()
  
  // Ends with question mark
  if (text.trim().endsWith('?')) {
    return true
  }

  // Starts with question word
  for (const qWord of QUESTION_WORDS) {
    if (trimmed.startsWith(qWord + ' ')) {
      return true
    }
  }

  return false
}

/**
 * Classify user message intent
 * 
 * @param message - User message to classify
 * @param context - Optional context (conversation history, etc.)
 * @returns Classification result with intent and confidence
 */
export function classifyIntent(
  message: string,
  context?: {
    previousIntent?: Intent
    conversationHistory?: Array<{ role: string; content: string }>
  }
): ClassificationResult {
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return {
      intent: 'UNKNOWN',
      confidence: 0,
      reasoning: 'Empty message'
    }
  }

  const normalizedMessage = normalizeText(message)
  const trimmedMessage = message.trim()

  // Check for very short or unclear messages
  if (trimmedMessage.length < 3) {
    return {
      intent: 'CLARIFICATION_NEEDED',
      confidence: 0.5,
      reasoning: 'Message too short to determine intent'
    }
  }

  // Calculate scores for each intent (excluding CLARIFICATION_NEEDED and UNKNOWN)
  const intentScores: Array<{ intent: Intent; score: number }> = []
  
  for (const intent of Object.keys(INTENT_KEYWORDS) as Intent[]) {
    if (intent === 'CLARIFICATION_NEEDED' || intent === 'UNKNOWN') {
      continue
    }

    const keywords = INTENT_KEYWORDS[intent]
    const score = calculateKeywordScore(trimmedMessage, keywords)
    
    // Boost score for questions if it's a query/explore intent
    if (isQuestion(trimmedMessage)) {
      if (intent === 'QUERY_RELATIONSHIPS' || intent === 'EXPLORE_STRUCTURE') {
        intentScores.push({ intent, score: score * 1.5 })
        continue
      }
    }

    intentScores.push({ intent, score })
  }

  // Sort by score (highest first)
  intentScores.sort((a, b) => b.score - a.score)

  // Get top intent
  const topIntent = intentScores[0]

  // Context-aware adjustments
  let finalIntent: Intent = topIntent?.intent || 'UNKNOWN'
  let confidence = topIntent?.score || 0

  // If previous intent was CLARIFICATION_NEEDED, likely the user is responding
  // Check if it's an answer to a question or a new request
  if (context?.previousIntent === 'CLARIFICATION_NEEDED') {
    // If it's a question, might be asking for clarification back
    if (isQuestion(trimmedMessage)) {
      finalIntent = 'QUERY_RELATIONSHIPS'
      confidence = 0.6
    }
    // Otherwise, likely answering the clarification question
    // Keep the original classification but boost confidence slightly
    else if (confidence > 0.3) {
      confidence = Math.min(1, confidence + 0.2)
    }
  }

  // If confidence is very low, might need clarification
  if (confidence < 0.3) {
    // Check if it's clearly a question but we couldn't classify it well
    if (isQuestion(trimmedMessage)) {
      // Default to EXPLORE_STRUCTURE for general questions
      finalIntent = 'EXPLORE_STRUCTURE'
      confidence = 0.4
    } else {
      // Very unclear, might need clarification
      finalIntent = 'CLARIFICATION_NEEDED'
      confidence = 0.3
    }
  }

  // Generate reasoning
  let reasoning: string | undefined
  if (confidence < 0.5) {
    reasoning = `Low confidence classification. Message may be ambiguous.`
  } else if (confidence >= 0.8) {
    reasoning = `High confidence classification based on keyword matching.`
  } else {
    reasoning = `Moderate confidence classification.`
  }

  return {
    intent: finalIntent,
    confidence: Math.min(1, Math.max(0, confidence)),
    reasoning
  }
}

/**
 * Get all possible intents for a message (for debugging)
 */
export function getAllIntentScores(message: string): Array<{ intent: Intent; score: number }> {
  const normalized = normalizeText(message)
  const scores: Array<{ intent: Intent; score: number }> = []

  for (const intent of Object.keys(INTENT_KEYWORDS) as Intent[]) {
    if (intent === 'CLARIFICATION_NEEDED' || intent === 'UNKNOWN') {
      continue
    }

    const keywords = INTENT_KEYWORDS[intent]
    const score = calculateKeywordScore(message, keywords)
    scores.push({ intent, score })
  }

  return scores.sort((a, b) => b.score - a.score)
}

