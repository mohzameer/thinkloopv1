import { useState, useEffect, useRef } from 'react'
import { Box, Stack, Text, ScrollArea, Paper, Badge, Flex, ActionIcon, Tabs, Textarea, Loader, Alert, Progress, Collapse, Button, Group } from '@mantine/core'
import { IconNote, IconCheck, IconRobot, IconMessageCircle, IconSend, IconAlertCircle, IconInfoCircle, IconAlertTriangle, IconChevronDown, IconChevronUp, IconCopy, IconGitBranch } from '@tabler/icons-react'
import ReactMarkdown from 'react-markdown'
import type { ChatMessage, ClarificationState, AIResponseData } from '../../hooks/useChat'
import type { ContextWarning } from '../../services/ai/contextManager'

interface Note {
  id: string
  content: string
  createdAt: Date
  updatedAt: Date
}

interface NotesSidebarProps {
  isCollapsed: boolean
  variationId: string | null
  variationIndex?: number
  mainItemSubItems?: Array<{ id: string; data: { name: string } }>
  notes: Note[]
  isLoading?: boolean
  onDeleteNote?: (id: string) => void
  onNoteClick?: (id: string) => void
  selectedNoteId?: string | null
  // Chat props
  messages: ChatMessage[]
  isLoadingMessages?: boolean
  isAIProcessing?: boolean
  contextWarning?: ContextWarning | null
  clarificationState?: ClarificationState | null
  onSendMessage?: (content: string) => Promise<string | null>
  onAnswerClarification?: (questionIndex: number, answer: string) => Promise<void>
  onCancelClarification?: () => void
  pendingAIDrawing?: AIResponseData | null
  onApplyDrawing?: () => void
  onDuplicateDrawing?: () => void
  onBranchAsMain?: () => void
}

export function NotesSidebar({ 
  isCollapsed, 
  variationId, 
  variationIndex, 
  mainItemSubItems, 
  notes, 
  isLoading = false, 
  onDeleteNote, 
  onNoteClick, 
  selectedNoteId,
  messages = [],
  isLoadingMessages = false,
  isAIProcessing = false,
  contextWarning = null,
  clarificationState = null,
  onSendMessage,
  onAnswerClarification,
  onCancelClarification,
  pendingAIDrawing,
  onApplyDrawing,
  onDuplicateDrawing,
  onBranchAsMain
}: NotesSidebarProps) {
  const [chatInput, setChatInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showContextDetails, setShowContextDetails] = useState(false)
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<number, string>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive or AI processing state changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' })
    }
  }, [messages, isAIProcessing])

  if (isCollapsed) {
    return null
  }

  // Calculate variation number (V1, V2, etc.)
  let variationLabel = 'Default'
  if (variationId && mainItemSubItems) {
    const index = mainItemSubItems.findIndex(item => item.id === variationId)
    if (index !== -1) {
      variationLabel = `V${index + 1}`
    } else if (variationIndex !== undefined) {
      variationLabel = `V${variationIndex + 1}`
    }
  } else if (variationIndex !== undefined) {
    variationLabel = `V${variationIndex + 1}`
  }

  const currentNotes = notes

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !onSendMessage || isSending || isAIProcessing) {
      return
    }

    const messageContent = chatInput.trim()
    setChatInput('')
    setIsSending(true)

    try {
      await onSendMessage(messageContent)
    } catch (error) {
      console.error('Error sending message:', error)
      // Restore input on error
      setChatInput(messageContent)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <Box
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
        borderLeft: '1px solid var(--border-color)',
        transition: 'background-color 0.3s ease, border-color 0.3s ease'
      }}
    >
      <Tabs defaultValue="chat" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--border-color)',
            transition: 'border-color 0.3s ease'
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="chat" leftSection={<IconRobot size={16} />}>
              AI Chat
            </Tabs.Tab>
            <Tabs.Tab value="notes" leftSection={<IconNote size={16} />}>
              Notes
              {currentNotes.length > 0 && (
                <Badge size="sm" variant="light" color="gray" ml={8}>
                  {currentNotes.length}
                </Badge>
              )}
            </Tabs.Tab>
          </Tabs.List>
          <Text size="xs" c="dimmed" mt={8}>
            Variation: {variationLabel}
          </Text>
        </Box>

        <Tabs.Panel value="chat" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ScrollArea
            ref={scrollAreaRef}
            style={{
              flex: 1,
              padding: '16px'
            }}
          >
            <Stack gap="md">
              {/* Context Warning Banner */}
              {contextWarning && (
                <Alert
                  icon={
                    contextWarning.level === 'critical' ? <IconAlertCircle size={16} /> :
                    contextWarning.level === 'warning' ? <IconAlertTriangle size={16} /> :
                    contextWarning.level === 'info' ? <IconInfoCircle size={16} /> :
                    null
                  }
                  title={
                    contextWarning.level === 'critical' ? 'Context Limit Reached' :
                    contextWarning.level === 'warning' ? 'Approaching Limit' :
                    contextWarning.level === 'info' ? 'Large Canvas' :
                    'Context Status'
                  }
                  color={
                    contextWarning.level === 'critical' ? 'red' :
                    contextWarning.level === 'warning' ? 'yellow' :
                    contextWarning.level === 'info' ? 'blue' :
                    'gray'
                  }
                  styles={{
                    root: {
                      fontSize: '12px'
                    },
                    title: {
                      fontSize: '12px',
                      fontWeight: 600
                    },
                    message: {
                      fontSize: '11px'
                    }
                  }}
                >
                  <Stack gap="xs">
                    {/* Token Count and Progress Bar */}
                    <Box>
                      <Flex justify="space-between" align="center" mb={4}>
                        <Text size="xs" fw={500}>
                          Token Usage
                        </Text>
                        <Text size="xs" c="dimmed">
                          {contextWarning.tokenCount.toLocaleString()} / {contextWarning.tokenLimit.toLocaleString()} tokens
                        </Text>
                      </Flex>
                      <Progress
                        value={contextWarning.percentage}
                        color={
                          contextWarning.level === 'critical' ? 'red' :
                          contextWarning.level === 'warning' ? 'yellow' :
                          contextWarning.level === 'info' ? 'blue' :
                          'gray'
                        }
                        size="sm"
                        radius="xs"
                        styles={{
                          root: {
                            backgroundColor: 'var(--bg-secondary)'
                          }
                        }}
                      />
                      <Text size="xs" c="dimmed" mt={2} ta="right">
                        {contextWarning.percentage.toFixed(1)}%
                      </Text>
                    </Box>

                    {/* Warning Message */}
                    {contextWarning.message && (
                      <Text size="xs" style={{ color: 'var(--text-primary)' }}>
                        {contextWarning.message}
                      </Text>
                    )}

                    {/* Context Summary */}
                    <Box>
                      <Flex justify="space-between" align="center" mb={4}>
                        <Text size="xs" fw={500}>
                          Context Summary
                        </Text>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          onClick={() => setShowContextDetails(!showContextDetails)}
                        >
                          {showContextDetails ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                        </ActionIcon>
                      </Flex>
                      <Text size="xs" c="dimmed">
                        Included: {contextWarning.included.messages} messages, {contextWarning.included.nodes} nodes, {contextWarning.included.edges} edges
                      </Text>
                      {contextWarning.truncated && (
                        <Text size="xs" c="red" mt={2}>
                          Truncated: {contextWarning.truncated.messages ? `${contextWarning.truncated.messages} messages, ` : ''}
                          {contextWarning.truncated.nodes ? `${contextWarning.truncated.nodes} nodes, ` : ''}
                          {contextWarning.truncated.edges ? `${contextWarning.truncated.edges} edges` : ''}
                        </Text>
                      )}
                    </Box>

                    {/* Expandable Details */}
                    <Collapse in={showContextDetails}>
                      <Paper p="xs" withBorder style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }} mt={4}>
                        <Stack gap="xs">
                          <Text size="xs" fw={500}>Included in Context:</Text>
                          <Text size="xs" c="dimmed">
                            • {contextWarning.included.messages} conversation messages
                          </Text>
                          <Text size="xs" c="dimmed">
                            • {contextWarning.included.nodes} canvas nodes
                          </Text>
                          <Text size="xs" c="dimmed">
                            • {contextWarning.included.edges} canvas edges
                          </Text>
                          {contextWarning.truncated && (
                            <>
                              <Text size="xs" fw={500} mt={4} c="red">Excluded from Context:</Text>
                              {contextWarning.truncated.messages && (
                                <Text size="xs" c="dimmed">
                                  • {contextWarning.truncated.messages} older messages (truncated to fit)
                                </Text>
                              )}
                              {contextWarning.truncated.nodes && (
                                <Text size="xs" c="dimmed">
                                  • {contextWarning.truncated.nodes} nodes (truncated to fit)
                                </Text>
                              )}
                              {contextWarning.truncated.edges && (
                                <Text size="xs" c="dimmed">
                                  • {contextWarning.truncated.edges} edges (truncated to fit)
                                </Text>
                              )}
                            </>
                          )}
                        </Stack>
                      </Paper>
                    </Collapse>
                  </Stack>
                </Alert>
              )}

              {/* Clarification Questions */}
              {clarificationState && clarificationState.isPending && (
                <Paper p="md" withBorder style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--accent-color)' }}>
                  <Stack gap="md">
                    <Flex justify="space-between" align="center">
                      <Text size="sm" fw={600} style={{ color: 'var(--text-primary)' }}>
                        Clarification Needed
                      </Text>
                      {onCancelClarification && (
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="gray"
                          onClick={onCancelClarification}
                        >
                          <IconChevronUp size={14} />
                        </ActionIcon>
                      )}
                    </Flex>
                    {clarificationState.context && (
                      <Text size="xs" c="dimmed">
                        {clarificationState.context}
                      </Text>
                    )}
                    <Stack gap="sm">
                      {clarificationState.questions.map((question, index) => (
                        <Box key={index}>
                          <Text size="xs" fw={500} mb={4} style={{ color: 'var(--text-primary)' }}>
                            {index + 1}. {question}
                          </Text>
                          <Textarea
                            placeholder="Your answer..."
                            value={clarificationAnswers[index] || ''}
                            onChange={(e) => setClarificationAnswers(prev => ({
                              ...prev,
                              [index]: e.target.value
                            }))}
                            minRows={2}
                            maxRows={4}
                            styles={{
                              input: {
                                backgroundColor: 'var(--bg-primary)',
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-primary)',
                                fontSize: '12px'
                              }
                            }}
                          />
                        </Box>
                      ))}
                    </Stack>
                    <Flex gap="xs" justify="flex-end">
                      {onCancelClarification && (
                        <ActionIcon
                          size="md"
                          variant="subtle"
                          color="gray"
                          onClick={onCancelClarification}
                          title="Cancel clarification"
                        >
                          <IconChevronUp size={16} />
                        </ActionIcon>
                      )}
                      <ActionIcon
                        size="md"
                        variant="filled"
                        color="blue"
                        disabled={
                          !onAnswerClarification ||
                          clarificationState.questions.some((_, idx) => !clarificationAnswers[idx]?.trim())
                        }
                        onClick={async () => {
                          if (!onAnswerClarification) return
                          setIsSending(true)
                          try {
                            // Submit all answers
                            for (let i = 0; i < clarificationState.questions.length; i++) {
                              if (clarificationAnswers[i]?.trim()) {
                                await onAnswerClarification(i, clarificationAnswers[i])
                              }
                            }
                            setClarificationAnswers({})
                          } finally {
                            setIsSending(false)
                          }
                        }}
                        loading={isSending}
                        title="Submit answers"
                      >
                        <IconSend size={16} />
                      </ActionIcon>
                    </Flex>
                  </Stack>
                </Paper>
              )}

              {isLoadingMessages && !isAIProcessing ? (
                <Flex justify="center" align="center" py="xl">
                  <Loader size="sm" />
                </Flex>
              ) : messages.length === 0 && !isAIProcessing ? (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  No messages yet. Start a conversation with the AI assistant.
                </Text>
              ) : (
                <>
                  {messages.map((message) => (
                  <Paper
                    key={message.id}
                    p="md"
                    withBorder
                    style={{
                      backgroundColor: message.role === 'user' ? 'var(--bg-secondary)' : 'white',
                      borderColor: 'var(--border-color)',
                      alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: message.role === 'assistant' ? '92%' : '85%'
                    }}
                  >
                    <Flex align="center" gap="xs" mb={8}>
                      {message.role === 'assistant' ? (
                        <IconRobot size={16} style={{ color: 'var(--text-primary)' }} />
                      ) : (
                        <IconMessageCircle size={16} style={{ color: 'var(--text-primary)' }} />
                      )}
                      <Text size="xs" fw={600} style={{ color: 'var(--text-primary)' }}>
                        {message.role === 'assistant' ? 'AI Assistant' : 'You'}
                      </Text>
                    </Flex>
                    <Box
                      style={{
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        lineHeight: 1.6
                      }}
                    >
                      <ReactMarkdown
                        components={{
                          // Style headings
                          h1: ({node, ...props}) => <Text size="lg" fw={700} mb="sm" mt="md" style={{ color: 'var(--text-primary)' }} {...props} />,
                          h2: ({node, ...props}) => <Text size="md" fw={700} mb="xs" mt="md" style={{ color: 'var(--text-primary)' }} {...props} />,
                          h3: ({node, ...props}) => <Text size="sm" fw={700} mb="xs" mt="sm" style={{ color: 'var(--text-primary)' }} {...props} />,
                          h4: ({node, ...props}) => <Text size="sm" fw={600} mb="xs" mt="xs" style={{ color: 'var(--text-primary)' }} {...props} />,
                          // Style paragraphs
                          p: ({node, ...props}) => <Text size="sm" mb="sm" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }} {...props} />,
                          // Style lists
                          ul: ({node, ...props}) => <Box component="ul" mb="sm" style={{ paddingLeft: '24px', marginTop: '4px', marginBottom: '8px' }} {...props} />,
                          ol: ({node, ...props}) => <Box component="ol" mb="sm" style={{ paddingLeft: '24px', marginTop: '4px', marginBottom: '8px' }} {...props} />,
                          li: ({node, ...props}) => <Text size="sm" component="li" mb="xs" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }} {...props} />,
                          // Style code blocks
                          code: ({node, inline, ...props}: any) => 
                            inline ? (
                              <Text 
                                component="code" 
                                size="sm" 
                                style={{ 
                                  backgroundColor: 'var(--bg-secondary)', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px',
                                  fontFamily: 'monospace',
                                  fontSize: '13px'
                                }} 
                                {...props} 
                              />
                            ) : (
                              <Box
                                component="pre"
                                style={{
                                  backgroundColor: 'var(--bg-secondary)',
                                  padding: '12px',
                                  borderRadius: '6px',
                                  overflow: 'auto',
                                  marginTop: '8px',
                                  marginBottom: '8px'
                                }}
                              >
                                <Text
                                  component="code"
                                  size="xs"
                                  style={{
                                    fontFamily: 'monospace',
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                  }}
                                  {...props}
                                />
                              </Box>
                            ),
                          // Style blockquotes
                          blockquote: ({node, ...props}) => (
                            <Box
                              component="blockquote"
                              style={{
                                borderLeft: '3px solid var(--border-color)',
                                paddingLeft: '12px',
                                marginLeft: 0,
                                marginTop: '8px',
                                marginBottom: '8px',
                                fontStyle: 'italic',
                                color: 'var(--text-secondary)'
                              }}
                              {...props}
                            />
                          ),
                          // Style links
                          a: ({node, ...props}: any) => (
                            <Text
                              component="a"
                              size="sm"
                              style={{
                                color: 'var(--primary-color, #228be6)',
                                textDecoration: 'underline',
                                cursor: 'pointer'
                              }}
                              {...props}
                            />
                          ),
                          // Style strong/bold
                          strong: ({node, ...props}) => <Text component="strong" fw={700} style={{ color: 'var(--text-primary)' }} {...props} />,
                          // Style emphasis/italic
                          em: ({node, ...props}) => <Text component="em" fs="italic" style={{ color: 'var(--text-primary)' }} {...props} />,
                          // Style horizontal rule
                          hr: ({node, ...props}) => (
                            <Box
                              component="hr"
                              style={{
                                border: 'none',
                                borderTop: '1px solid var(--border-color)',
                                margin: '16px 0'
                              }}
                              {...props}
                            />
                          )
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </Box>
                    <Text 
                      size="xs" 
                      c="dimmed"
                      style={{ 
                        marginTop: '8px'
                      }}
                    >
                      {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {/* Show action buttons if this is the last assistant message and there's a pending drawing */}
                    {message.role === 'assistant' && 
                     pendingAIDrawing && 
                     message.id === messages.filter(m => m.role === 'assistant').slice(-1)[0]?.id && 
                     (message.content.includes('Would you like me to proceed') || message.content.includes('proceed')) && (
                      <Group gap="xs" mt="md" pt="md" style={{ borderTop: '1px solid var(--border-color)' }}>
                        <Button
                          size="xs"
                          variant="filled"
                          color="blue"
                          onClick={onApplyDrawing}
                          leftSection={<IconCheck size={14} />}
                          style={{ flex: 1 }}
                        >
                          Apply
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          color="gray"
                          onClick={onDuplicateDrawing}
                          leftSection={<IconCopy size={14} />}
                          style={{ flex: 1.3 }}
                        >
                          Duplicate
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          color="gray"
                          onClick={onBranchAsMain}
                          leftSection={<IconGitBranch size={14} />}
                          style={{ flex: 1 }}
                        >
                          Branch
                        </Button>
                      </Group>
                    )}
                  </Paper>
                  ))}
                  {isAIProcessing && (
                    <Paper 
                      p="md" 
                      withBorder 
                      style={{ 
                        backgroundColor: 'var(--bg-secondary)', 
                        borderColor: 'var(--border-color)',
                        alignSelf: 'flex-start',
                        maxWidth: '85%'
                      }}
                    >
                      <Flex align="center" gap="xs">
                        <Loader size="sm" />
                        <Text size="sm" style={{ color: 'var(--text-primary)' }}>
                          AI is thinking...
                        </Text>
                      </Flex>
                    </Paper>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </Stack>
          </ScrollArea>
          <Box
            style={{
              padding: '16px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)'
            }}
          >
            <Flex gap="sm" align="flex-end">
              <Textarea
                placeholder="Type your message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                autosize
                minRows={1}
                maxRows={4}
                style={{ flex: 1 }}
                disabled={isSending || isAIProcessing || !onSendMessage}
                styles={{
                  input: {
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)'
                  }
                }}
              />
              <ActionIcon
                size="lg"
                variant="filled"
                color="blue"
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || isSending || isAIProcessing || !onSendMessage}
                loading={isSending || isAIProcessing}
                style={{
                  height: '36px',
                  width: '36px'
                }}
              >
                <IconSend size={18} />
              </ActionIcon>
            </Flex>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="notes" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ScrollArea
            style={{
              flex: 1,
              padding: '16px'
            }}
          >
            <Stack gap="md">
              {isLoading ? (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  Loading notes...
                </Text>
              ) : currentNotes.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  No comments yet. Click the comment button and add your first note on the canvas.
                </Text>
              ) : (
                currentNotes.map((note) => (
                  <Paper
                    key={note.id}
                    p="md"
                    withBorder
                    onClick={() => onNoteClick?.(note.id)}
                    style={{
                      backgroundColor: 'white',
                      borderColor: selectedNoteId === note.id ? '#ef4444' : 'var(--border-color)',
                      borderWidth: selectedNoteId === note.id ? '2px' : '1px',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  >
                    {onDeleteNote && (
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="green"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteNote(note.id)
                        }}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          zIndex: 10
                        }}
                        title="Delete note"
                      >
                        <IconCheck size={16} />
                      </ActionIcon>
                    )}
                    <Box
                      style={{
                        paddingRight: onDeleteNote ? '32px' : '0'
                      }}
                    >
                      <Text 
                        size="sm" 
                        style={{ 
                          color: 'var(--text-primary)', 
                          whiteSpace: 'pre-wrap', 
                          wordBreak: 'break-word',
                          fontWeight: 400
                        }}
                      >
                        {note.content}
                      </Text>
                      <Text 
                        size="xs" 
                        c="dimmed"
                        style={{ 
                          marginTop: '8px'
                        }}
                      >
                        {note.createdAt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at{' '}
                        {note.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </Box>
                  </Paper>
                ))
              )}
            </Stack>
          </ScrollArea>
        </Tabs.Panel>
      </Tabs>
    </Box>
  )
}

