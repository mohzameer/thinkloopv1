/**
 * Prompt Builder
 * 
 * Constructs prompts for Claude API with system prompts, canvas context,
 * conversation history, and intent-specific instructions
 */

import type { AIMessage } from './aiService'

// Backward compatibility
type ClaudeMessage = AIMessage

export type Intent = 
  | 'ADD_NODES'
  | 'QUERY_RELATIONSHIPS'
  | 'EXPLORE_STRUCTURE'
  | 'SIMULATE'
  | 'MODIFY'
  | 'CLARIFICATION_NEEDED'
  | 'UNKNOWN'

export interface PromptOptions {
  intent?: Intent
  canvasContext?: string
  conversationHistory?: Array<{ role: string; content: string }>
  userMessage: string
  maxHistoryMessages?: number
}

/**
 * Get system prompt template
 */
function getSystemPrompt(): string {
  return `You are an AI assistant helping users explore and build knowledge graphs on a canvas.

CAPABILITIES:
- Understand existing canvas structures (nodes, edges, relationships)
- Answer questions about relationships and structures
- Add new nodes and edges based on user requests
- Update/rename existing node labels (with user permission)
- Ask clarifying questions when the structure is unclear
- Suggest improvements or explore ideas

CANVAS FORMAT:
- Nodes have: ID, type (rectangle/circle/diamond/triangle), label/content, position, tags
- **IMPORTANT**: Node labels contain the main content/text for each node. Pay close attention to the full text in node labels as it provides context and meaning.
- Edges connect nodes with relationship labels
- **IMPORTANT**: Edge labels describe the relationship between nodes. Use these labels to understand how nodes relate to each other.
- You can add nodes by specifying: label, type, position (relative or absolute), connections

RESPONSE FORMAT:
For ADD operations: Return JSON with this structure:
{
  "action": "add",
  "nodes": [
    {
      "label": "Node label text (will be displayed on the node)",
      "type": "rectangle" | "circle" | "diamond" | "triangle",
      "position": {"x": 100, "y": 200} OR "positionRelative": {"relativeTo": "node_id", "offset": {"x": 150, "y": 0}}
      // Note: Do NOT include "tags" - categories/tags are added manually by users
    }
  ],
  "edges": [
    {
      "source": "node_id_or_label",
      "target": "node_id_or_label",
      "label": "relationship description"
    }
  ],
  "explanation": "Brief explanation of what was added"
}

For QUERY/EXPLORE operations: Return natural language explanation:
{
  "action": "answer",
  "response": "Your explanation here..."
}

For UPDATE operations (renaming/updating node labels): Return JSON with this structure:
{
  "action": "update",
  "nodeUpdates": [
    {
      "nodeId": "node_id" OR "nodeLabel": "current node label",
      "newLabel": "New label text for the node"
    }
  ],
  "explanation": "Brief explanation of what was updated"
}
Note: Use nodeId if you know it, otherwise use nodeLabel to identify the node. The user will be asked for permission before applying updates.

For CLARIFICATION: Return questions:
{
  "action": "clarify",
  "questions": ["Question 1?", "Question 2?"],
  "context": "Context about what's unclear..."
}

COMPLEXITY LIMITS:
- **IMPORTANT**: If a request requires more than 5 nodes, inform the user that the scenario is complex
- For complex scenarios (more than 5 nodes), suggest breaking it down into smaller steps
- Only proceed with more than 5 nodes if the user explicitly requests it
- For simulations, limit yourself to 5 steps unless the user explicitly asks for more
- If computations become too heavy, stop and inform the user rather than continuing

IMPORTANT:
- Always return valid JSON
- **When READING the diagram**: Pay close attention to node label text - it contains the actual content and context for each node
- **When READING the diagram**: Pay close attention to edge labels - they describe the relationships and connections between nodes
- **When CREATING nodes**: Include the "label" field - it will be displayed on the node
- **When CREATING nodes**: Do NOT include "tags" or "categories" - these are added manually by users
- **When CREATING nodes**: Limit to 5 nodes per request unless user explicitly asks for more
- **When READING**: Use the full text from node labels to understand what each node represents
- **When READING**: Use edge labels to understand how nodes relate to each other
- For node references in edges, use node IDs when possible, or node labels if ID is unknown
- When adding nodes, consider the existing structure and relationships based on node content and edge labels
- Position nodes intelligently (avoid overlaps, maintain visual hierarchy)
- If unsure about placement or relationships, ask for clarification`
}

/**
 * Get intent-specific instructions
 */
function getIntentInstructions(intent: Intent): string {
  switch (intent) {
    case 'ADD_NODES':
      return `\nCURRENT TASK: Adding nodes/edges to the canvas.
- **Read the full text from existing node labels** to understand the context and content
- **Read edge labels** to understand existing relationships
- Analyze the user's request carefully in context of existing node content
- **IMPORTANT**: Limit to 5 nodes per request. If the request requires more than 5 nodes, inform the user that it's complex and suggest breaking it down
- Only create more than 5 nodes if the user explicitly requests it
- Identify which nodes to add and how they relate to existing nodes based on their content
- Determine appropriate node types (rectangle for concepts, circle for entities, etc.)
- **When creating nodes**: Include the "label" field - it will be displayed on the node
- **When creating nodes**: Do NOT include "tags" or "categories" - these are added manually by users
- When creating edges, use descriptive labels that explain the relationship
- Consider the semantic meaning from node labels when positioning and connecting
- Calculate positions relative to existing nodes or use smart defaults
- Create edges to connect new nodes to existing structure with meaningful relationship labels
- Return JSON with "action": "add"`

    case 'QUERY_RELATIONSHIPS':
      return `\nCURRENT TASK: Answering questions about relationships.
- **Read the full text from node labels** to understand what each node represents
- **Read edge labels carefully** - they describe the relationships between nodes
- **When creating nodes**: Include the label field - it will be displayed on the node
- **When creating nodes**: Do NOT include tags/categories - these are added manually by users
- Analyze the canvas structure to understand connections
- Use graph analysis data (central nodes, clusters, paths) to provide insights
- Trace paths between nodes if needed (shortest path, all paths)
- Calculate relationship strength (direct connections, path length, common neighbors)
- Explain relationships clearly and concisely with specific metrics
- Reference specific nodes by their labels and content
- Mention if nodes are in the same cluster or have common neighbors
- Use the relationship descriptions from edge labels to explain connections
- Return JSON with "action": "answer"`

    case 'EXPLORE_STRUCTURE':
      return `\nCURRENT TASK: Exploring and explaining the canvas structure.
- Provide an overview of the canvas
- Identify key nodes and their roles
- Explain the overall structure and organization
- Highlight important relationships
- Return JSON with "action": "answer"`

    case 'SIMULATE':
      return `\nCURRENT TASK: Simulating scenarios or exploring possibilities.
- Use the canvas structure to reason about scenarios
- Consider how changes might affect the structure
- **IMPORTANT**: Limit simulations to 5 steps unless the user explicitly asks for more
- If the simulation requires more than 5 steps, inform the user and suggest breaking it down
- Provide thoughtful analysis based on the graph
- Return JSON with "action": "answer"`

    case 'MODIFY':
      return `\nCURRENT TASK: Modifying existing nodes or edges.
- **You can now update/rename node labels** - use "action": "update" for this
- Identify which nodes need modification (by ID or label)
- For renaming nodes: Use "action": "update" with nodeUpdates array
- For other modifications: Use "action": "add" (for adding replacement nodes) or "answer" (for explanations)
- When updating node labels, provide both the current identifier (nodeId or nodeLabel) and the newLabel
- The user will be asked for permission before updates are applied
- Return JSON with "action": "update" for node label changes`

    case 'CLARIFICATION_NEEDED':
      return `\nCURRENT TASK: The user's request is unclear.
- Identify what information is missing
- Ask specific, helpful questions
- Provide context about what you understand so far
- Return JSON with "action": "clarify"`

    default:
      return `\nCURRENT TASK: General assistance.
- Understand the user's intent
- Provide helpful responses
- If adding nodes, use "action": "add"
- If answering questions, use "action": "answer"
- If clarification needed, use "action": "clarify"`
  }
}

/**
 * Format conversation history for prompt
 */
function formatConversationHistory(
  history: Array<{ role: string; content: string }>,
  maxMessages: number = 15
): string {
  if (history.length === 0) {
    return ''
  }

  // Take last N messages
  const recentMessages = history.slice(-maxMessages)
  
  let formatted = '\nCONVERSATION HISTORY:\n'
  recentMessages.forEach((msg, idx) => {
    const role = msg.role === 'user' ? 'User' : 'Assistant'
    formatted += `${role}: ${msg.content}\n`
  })
  
  return formatted
}

/**
 * Build complete prompt for Claude API
 */
export function buildPrompt(options: PromptOptions): {
  systemPrompt: string
  messages: ClaudeMessage[]
} {
  const {
    intent = 'UNKNOWN',
    canvasContext = '',
    conversationHistory = [],
    userMessage,
    maxHistoryMessages = 15
  } = options

  // Build system prompt
  let systemPrompt = getSystemPrompt()
  
  // Add canvas context if provided
  if (canvasContext) {
    systemPrompt += `\n\n${canvasContext}`
  }
  
  // Add intent-specific instructions
  systemPrompt += getIntentInstructions(intent)

  // Build messages array
  const messages: ClaudeMessage[] = []

  // Add conversation history (last N messages, excluding the current one)
  const historyToInclude = conversationHistory.slice(-maxHistoryMessages)
  historyToInclude.forEach(msg => {
    // Convert role to Claude format (user/assistant)
    const role = msg.role === 'assistant' ? 'assistant' : 'user'
    messages.push({
      role,
      content: msg.content
    })
  })

  // Add current user message
  messages.push({
    role: 'user',
    content: userMessage
  })

  return {
    systemPrompt,
    messages
  }
}

/**
 * Build prompt with formatted conversation history (alternative format)
 * This version includes history in the system prompt instead of messages
 */
export function buildPromptWithHistoryInSystem(options: PromptOptions): {
  systemPrompt: string
  messages: ClaudeMessage[]
} {
  const {
    intent = 'UNKNOWN',
    canvasContext = '',
    conversationHistory = [],
    userMessage,
    maxHistoryMessages = 15
  } = options

  // Build system prompt
  let systemPrompt = getSystemPrompt()
  
  // Add canvas context if provided
  if (canvasContext) {
    systemPrompt += `\n\n${canvasContext}`
  }
  
  // Add conversation history to system prompt
  if (conversationHistory.length > 0) {
    systemPrompt += formatConversationHistory(conversationHistory, maxHistoryMessages)
  }
  
  // Add intent-specific instructions
  systemPrompt += getIntentInstructions(intent)

  // Only current user message in messages array
  const messages: ClaudeMessage[] = [
    {
      role: 'user',
      content: userMessage
    }
  ]

  return {
    systemPrompt,
    messages
  }
}

