# AI Agent Integration - Quick Reference

## Quick Start Checklist

### Phase 1: Foundation
- [ ] Add `VITE_ANTHROPIC_API_KEY` to `.env`
- [ ] Install token counter (or use approximation)
- [ ] Build canvas context extractor
- [ ] Create Claude API service
- [ ] Implement context window manager with warnings

### Phase 2: AI Logic
- [ ] Build prompt builder
- [ ] Create response parser
- [ ] Implement intent classifier
- [ ] Build node/edge generator

### Phase 3: Integration
- [ ] Integrate AI into `useChat` hook
- [ ] Connect to canvas state in `CanvasPage`
- [ ] Add UI warnings in `NotesSidebar`

### Phase 4: Advanced
- [ ] Clarification flow
- [ ] Smart positioning
- [ ] Relationship analysis

### Phase 5: Polish
- [ ] Error handling
- [ ] Performance optimization
- [ ] Testing

---

## Token Limits & Warnings

| Usage | Level | Action |
|-------|-------|--------|
| < 50% | None | Normal operation |
| 50-75% | Info | Show info banner |
| 75-90% | Warning | Auto-truncate, show warning |
| 90%+ | Critical | Prevent send, require action |

**Context Window**: 200,000 tokens (Claude Sonnet 4.5)  
**Reserve**: 20,000 tokens for AI response

---

## Response Types

### ADD Action
```json
{
  "action": "add",
  "nodes": [{ "label": "...", "type": "rectangle", ... }],
  "edges": [{ "source": "...", "target": "...", ... }],
  "explanation": "..."
}
```

### ANSWER Action
```json
{
  "action": "answer",
  "response": "Natural language explanation..."
}
```

### CLARIFY Action
```json
{
  "action": "clarify",
  "questions": ["Question 1?", "Question 2?"],
  "context": "Context about what's unclear..."
}
```

---

## File Structure

```
src/services/ai/
  ├── claudeService.ts
  ├── tokenCounter.ts
  ├── contextManager.ts
  ├── contextExtractor.ts
  ├── promptBuilder.ts
  ├── responseParser.ts
  ├── intentClassifier.ts
  ├── nodeGenerator.ts
  └── truncationStrategy.ts
```

---

## Key Functions

### Token Counting
```typescript
countTokens(text: string): number
estimateTokens(obj: any): number
```

### Context Management
```typescript
getContextWarning(tokenCount: number): ContextWarning | null
truncateContext(context: CanvasContext, maxTokens: number): CanvasContext
```

### AI Integration
```typescript
generateAIResponse(
  message: string,
  nodes: Node[],
  edges: Edge[],
  conversationHistory: Message[]
): Promise<AIResponse>
```

---

## Common Issues & Solutions

**Issue**: Token limit exceeded  
**Solution**: Truncate old messages, summarize distant nodes

**Issue**: Invalid node references  
**Solution**: Use label → ID mapping, ask for clarification

**Issue**: Position conflicts  
**Solution**: Auto-adjust positions, use grid layout

**Issue**: Ambiguous requests  
**Solution**: Ask clarifying questions, use context

---

## Testing Checklist

- [ ] Empty canvas
- [ ] Single node
- [ ] Large canvas (1000+ nodes)
- [ ] Long conversation
- [ ] Ambiguous requests
- [ ] Network failures
- [ ] Token limit exceeded
- [ ] Invalid AI responses

