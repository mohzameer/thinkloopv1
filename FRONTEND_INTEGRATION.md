# Frontend Integration Guide - Backend API

## Overview

After building the backend API, you'll need to update the frontend to use it instead of calling Anthropic API directly.

## Changes Required

### 1. Update `claudeService.ts`

**File**: `src/services/ai/claudeService.ts`

**Change the API base URL**:

```typescript
// OLD (direct API - causes CORS):
const API_BASE_URL = 'https://api.anthropic.com/v1'

// NEW (backend proxy):
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api/anthropic'
```

**Remove API key from frontend**:

The `getApiKey()` function and API key header should be removed since the backend handles authentication:

```typescript
// OLD - Remove this function:
function getApiKey(): string {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('VITE_ANTHROPIC_API_KEY is not set')
  }
  return apiKey
}

// OLD - Remove from fetch headers:
headers: {
  'Content-Type': 'application/json',
  'x-api-key': apiKey,  // ← Remove this line
  'anthropic-version': '2023-06-01'
}

// NEW - Backend handles API key:
headers: {
  'Content-Type': 'application/json'
  // API key is handled by backend
}
```

### 2. Update Environment Variables

**File**: `.env.local`

**Remove** (no longer needed in frontend):
```env
VITE_ANTHROPIC_API_KEY=...  # Remove this
```

**Add** (backend URL):
```env
VITE_BACKEND_URL=http://localhost:3001
```

For production:
```env
VITE_BACKEND_URL=https://your-backend-domain.com
```

### 3. Update Request Function

**File**: `src/services/ai/claudeService.ts`

**Update the fetch call**:

```typescript
// The URL will now point to your backend
const response = await fetch(`${API_BASE_URL}/messages`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
    // No x-api-key header needed
  },
  body: JSON.stringify(requestBody),
  signal: controller.signal
})
```

## Model Abstraction

The backend implements model abstraction, allowing you to:
- **Swap models** by changing `DEFAULT_AI_MODEL` env var in backend (no frontend changes needed)
- **Route models** based on business logic (user tiers, request types, etc.)
- **Override models** per request if needed

The frontend can optionally specify a model, but the backend has final control over model selection.

## Complete Updated `claudeService.ts` Example

```typescript
// API Configuration
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api/anthropic'

// Model abstraction: Default model can be configured via env var
// Backend will handle model selection/routing, so this is just a fallback
const DEFAULT_MODEL = import.meta.env.VITE_AI_MODEL || 'claude-sonnet-4-5-20250929'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_TEMPERATURE = 0.7
const REQUEST_TIMEOUT = 60000
const MAX_RETRIES = 3

// Remove getApiKey() function - backend handles authentication

export async function sendMessage(
  options: ClaudeRequestOptions
): Promise<ClaudeResponse> {
  // Model abstraction: Use provided model or fallback to default
  // Backend can override this if needed
  const model = options.model || DEFAULT_MODEL
  const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE

  // Prepare messages
  const messages = options.messages.filter(msg => msg.role !== 'system')
  const systemMessage = options.messages.find(msg => msg.role === 'system')?.content || options.system

  const requestBody = {
    model, // Optional - backend can override
    max_tokens: maxTokens,
    temperature,
    messages: messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      content: msg.content
    })),
    ...(systemMessage && { system: systemMessage })
  }

  const response = await fetch(`${API_BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      // Remove: 'x-api-key' - backend handles it
      // Remove: 'anthropic-version' - backend handles it
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal
  })

  // ... rest of error handling stays the same ...
}
```

## Testing

1. **Start Backend**: `cd backend && npm start`
2. **Start Frontend**: `npm run dev`
3. **Test**: Send a message in the chat - it should work without CORS errors

## Production Deployment

1. Deploy backend to your server (e.g., Heroku, Railway, Render)
2. Update `VITE_BACKEND_URL` in frontend production environment
3. Remove `VITE_ANTHROPIC_API_KEY` from frontend (no longer needed)
4. Ensure backend has `ANTHROPIC_API_KEY` set in production environment



