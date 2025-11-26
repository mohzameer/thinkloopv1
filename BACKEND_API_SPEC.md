# Backend API Specification - AI Provider Abstraction

## Overview

This document specifies the Node.js Express backend API endpoint that provides a **provider-agnostic AI service**. The backend can route requests to different AI providers (Anthropic/Claude, OpenAI/GPT, DeepSeek, etc.) based on model name or configuration, solving CORS issues and providing a unified interface.

## Problem Statement

AI provider APIs (Anthropic, OpenAI, DeepSeek, etc.) do not allow direct browser requests due to CORS (Cross-Origin Resource Sharing) restrictions. The frontend needs a backend proxy to:
- Make API calls server-side (no CORS restrictions)
- Keep API keys secure (not exposed in frontend code)
- Handle errors and retries server-side
- **Abstract provider differences** - frontend doesn't need to know which provider is used
- **Enable provider switching** - change providers without frontend changes

## Solution Architecture

```
Frontend (React/Vite)
    ↓ HTTP Request (provider-agnostic)
Backend (Express)
    ↓ Provider Router
    ├─→ Anthropic API (Claude models)
    ├─→ OpenAI API (GPT models)
    ├─→ DeepSeek API (DeepSeek models)
    └─→ Other providers...
    ↓ Standardized Response
Backend (Express)
    ↓ HTTP Response (unified format)
Frontend (React/Vite)
```

## Backend Requirements

### Technology Stack
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **HTTP Client**: Built-in `fetch` (Node 18+) or `node-fetch`
- **Environment**: Use environment variables for API key

### Project Structure
```
backend/
├── package.json
├── .env
├── .env.example
├── server.js (or index.js)
└── providers/
    ├── anthropic.js
    ├── openai.js
    ├── deepseek.js
    └── base.js (base provider interface)
```

## API Endpoint Specification

### Endpoint: `POST /api/ai/messages`

**Purpose**: Provider-agnostic AI API endpoint that routes to appropriate provider based on model or configuration

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```typescript
{
  model?: string                    // Optional, backend will use DEFAULT_AI_MODEL env var or route to appropriate provider
  max_tokens?: number               // Optional, defaults to 4096
  temperature?: number              // Optional, defaults to 0.7
  system?: string                   // Optional system message
  provider?: string                 // Optional provider hint (e.g., "anthropic", "openai", "deepseek")
  messages: Array<{
    role: "user" | "assistant" | "system"  // Required
    content: string                 // Required
  }>
}
```

**Provider & Model Abstraction**:
- Frontend can optionally specify a model in the request
- Backend automatically routes to appropriate provider based on model name or configuration
- Backend can override/route models based on configuration
- Backend uses `DEFAULT_AI_MODEL` env var if no model is provided
- Provider selection is transparent to frontend
- This allows provider/model swapping without frontend changes

**Response Headers**:
```
Content-Type: application/json
```

**Success Response** (200 OK):
```typescript
{
  content: string                   // AI response text (standardized across providers)
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  provider?: string                 // Optional: which provider was used (e.g., "anthropic", "openai")
}
```

**Error Response** (4xx/5xx):
```typescript
{
  error: string                     // Error message
  type?: string                     // Error type (optional)
  statusCode?: number               // HTTP status code (optional)
}
```

## Implementation Details

### 1. Express Server Setup

```javascript
// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Allow frontend to call this API
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Anthropic proxy endpoint
app.post('/api/anthropic/messages', async (req, res) => {
  // Implementation below
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 2. Provider Abstraction Implementation

The backend implements a provider abstraction layer that routes requests to different AI providers based on model name or configuration.

#### Provider Router

```javascript
/**
 * Determine which provider to use based on model name
 */
function getProviderForModel(model) {
  const modelLower = model.toLowerCase();
  
  // Anthropic/Claude models
  if (modelLower.includes('claude') || modelLower.includes('sonnet') || modelLower.includes('opus')) {
    return 'anthropic';
  }
  
  // OpenAI/GPT models
  if (modelLower.includes('gpt') || modelLower.includes('o1') || modelLower.includes('dall-e')) {
    return 'openai';
  }
  
  // DeepSeek models
  if (modelLower.includes('deepseek')) {
    return 'deepseek';
  }
  
  // Default provider from env
  return process.env.DEFAULT_AI_PROVIDER || 'anthropic';
}

/**
 * Model abstraction: Get the model to use for this request
 */
function getModelForRequest(requestedModel) {
  if (requestedModel) {
    return requestedModel;
  }
  return process.env.DEFAULT_AI_MODEL || 'claude-sonnet-4-5-20250929';
}
```

#### Provider Implementations

Create provider modules in `providers/` directory:

**providers/anthropic.js:**
```javascript
export async function callAnthropic(apiKey, model, messages, options) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: options.max_tokens || 4096,
      temperature: options.temperature || 0.7,
      messages: messages.filter(m => m.role !== 'system'),
      ...(options.system && { system: options.system })
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Anthropic API error');
  }
  
  const data = await response.json();
  return {
    content: data.content?.map(b => b.text || '').join('') || '',
    usage: data.usage ? {
      inputTokens: data.usage.input_tokens || 0,
      outputTokens: data.usage.output_tokens || 0
    } : undefined,
    provider: 'anthropic'
  };
}
```

**providers/openai.js:**
```javascript
export async function callOpenAI(apiKey, model, messages, options) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: options.max_tokens || 4096,
      temperature: options.temperature || 0.7,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'OpenAI API error');
  }
  
  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || '',
    usage: data.usage ? {
      inputTokens: data.usage.prompt_tokens || 0,
      outputTokens: data.usage.completion_tokens || 0
    } : undefined,
    provider: 'openai'
  };
}
```

**providers/deepseek.js:**
```javascript
export async function callDeepSeek(apiKey, model, messages, options) {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: options.max_tokens || 4096,
      temperature: options.temperature || 0.7,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'DeepSeek API error');
  }
  
  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || '',
    usage: data.usage ? {
      inputTokens: data.usage.prompt_tokens || 0,
      outputTokens: data.usage.completion_tokens || 0
    } : undefined,
    provider: 'deepseek'
  };
}
```

#### Main Endpoint Implementation

```javascript
import { callAnthropic } from './providers/anthropic.js';
import { callOpenAI } from './providers/openai.js';
import { callDeepSeek } from './providers/deepseek.js';

app.post('/api/ai/messages', async (req, res) => {
  try {
    // Get API key from environment
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY not configured on server'
      });
    }

    // Extract request body
    const {
      model: requestedModel,
      max_tokens = 4096,
      temperature = 0.7,
      system,
      messages
    } = req.body;
    
    // Model abstraction: Determine which model to use
    const model = getModelForRequest(requestedModel);

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'messages array is required and must not be empty'
      });
    }

    // Prepare request to Anthropic API
    const requestBody = {
      model,
      max_tokens,
      temperature,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      ...(system && { system })
    };

    // Make request to Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    // Handle non-OK responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      return res.status(response.status).json({
        error: errorData.error?.message || `API error: ${response.statusText}`,
        type: errorData.error?.type || 'api_error',
        statusCode: response.status
      });
    }

    // Parse successful response
    const data = await response.json();
    
    // Extract content from response
    const content = data.content
      ?.map((block) => block.text || block.content || '')
      .join('') || '';

    // Return formatted response
    res.json({
      content,
      usage: data.usage ? {
        inputTokens: data.usage.input_tokens || 0,
        outputTokens: data.usage.output_tokens || 0
      } : undefined
    });

  } catch (error) {
    console.error('[Backend] Error proxying Anthropic request:', error);
    
    // Handle network errors
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return res.status(504).json({
        error: 'Request timed out. Please try again.',
        type: 'timeout'
      });
    }

    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      return res.status(503).json({
        error: 'Network error. Please check your connection.',
        type: 'network_error'
      });
    }

    // Generic error
    return res.status(500).json({
      error: error.message || 'Internal server error',
      type: 'unknown'
    });
  }
});
```

### 3. Environment Variables

Create `.env` file:
```env
# Provider API Keys (configure the providers you want to use)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Default AI Model (optional, allows easy model/provider swapping without frontend changes)
# Examples: 
#   Anthropic: claude-sonnet-4-5-20250929, claude-opus-3
#   OpenAI: gpt-4, gpt-3.5-turbo, o1-preview
#   DeepSeek: deepseek-chat, deepseek-coder
DEFAULT_AI_MODEL=claude-sonnet-4-5-20250929

# Default Provider (optional, used when model doesn't match any provider pattern)
DEFAULT_AI_PROVIDER=anthropic

# Server Port (optional, defaults to 3001)
PORT=3001

# Node Environment
NODE_ENV=development
```

Create `.env.example`:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEFAULT_AI_MODEL=claude-sonnet-4-5-20250929
DEFAULT_AI_PROVIDER=anthropic
PORT=3001
NODE_ENV=development
```

### 4. Package.json

```json
{
  "name": "thinkloops-backend",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "dev": "node --watch server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  }
}
```

## Model Abstraction Architecture

### Overview

The backend implements a model abstraction layer that allows:
- **Easy model swapping** without frontend code changes
- **Model routing** based on business logic (user tiers, request types, etc.)
- **Centralized model configuration** via environment variables
- **Frontend flexibility** to optionally specify models

### How It Works

1. **Frontend** can optionally pass a `model` parameter in the request
2. **Backend** uses `getModelForRequest()` to determine the final model:
   - If model is provided in request → use it (or override based on routing logic)
   - If no model provided → use `DEFAULT_AI_MODEL` env var
   - Fallback to hardcoded default if env var not set
3. **Backend** makes API call with the determined model
4. **Response** is returned to frontend (model used is transparent to frontend)

### Benefits

- ✅ Change models in production by updating `DEFAULT_AI_MODEL` env var
- ✅ Route different users to different models (premium vs free)
- ✅ A/B test different models
- ✅ Switch models for maintenance/outages
- ✅ No frontend deployment needed for model changes

### Advanced Model Routing Example

```javascript
function getModelForRequest(requestedModel, userId, requestType) {
  // Premium users get better model
  if (isPremiumUser(userId)) {
    return 'claude-opus-3';
  }
  
  // Specific request types use specific models
  if (requestType === 'code-generation') {
    return 'claude-3-5-sonnet-20241022';
  }
  
  // Use requested model if provided
  if (requestedModel) {
    return requestedModel;
  }
  
  // Default from env
  return process.env.DEFAULT_AI_MODEL || 'claude-sonnet-4-5-20250929';
}
```

## Frontend Integration

### Update `claudeService.ts`

Change the API base URL to point to your backend:

```typescript
// API Configuration
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api/anthropic'

// Model abstraction: Default model can be configured via env var
// Backend will handle model selection/routing, so this is just a fallback
const DEFAULT_MODEL = import.meta.env.VITE_AI_MODEL || 'claude-sonnet-4-5-20250929'
```

### Environment Variables

Add to frontend `.env.local`:
```env
# Backend API URL
VITE_BACKEND_URL=http://localhost:3001

# Optional: Default model (backend can override this)
# VITE_AI_MODEL=claude-sonnet-4-5-20250929
```

### Update Request Function

The frontend code can remain mostly the same, but update the fetch URL:

```typescript
// Model is optional - backend will determine the final model to use
const requestBody = {
  model: options.model || DEFAULT_MODEL, // Optional, backend can override
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
    'Content-Type': 'application/json',
    // Remove x-api-key header - backend handles it
  },
  body: JSON.stringify(requestBody),
  signal: controller.signal
})
```

**Important**: 
- Remove the `x-api-key` header from frontend requests since the backend will add it
- Model parameter is optional - backend handles model selection/routing

## Error Handling

### Error Types to Handle

1. **400 Bad Request**: Invalid request body
2. **401 Unauthorized**: Invalid API key
3. **429 Too Many Requests**: Rate limit exceeded
4. **500 Internal Server Error**: Server error
5. **502/503/504**: Network/timeout errors

### Error Response Format

All errors should return:
```json
{
  "error": "Human-readable error message",
  "type": "error_type",
  "statusCode": 400
}
```

## Security Considerations

1. **API Key Security**:
   - Never expose API key in frontend code
   - Store API key in backend `.env` file
   - Add `.env` to `.gitignore`
   - Use environment variables in production

2. **CORS Configuration**:
   - Configure CORS to only allow your frontend domain
   - Example:
     ```javascript
     app.use(cors({
       origin: process.env.FRONTEND_URL || 'http://localhost:5173',
       credentials: true
     }));
     ```

3. **Rate Limiting** (Optional but recommended):
   ```javascript
   import rateLimit from 'express-rate-limit';
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   });
   
   app.use('/api/anthropic', limiter);
   ```

4. **Request Validation**:
   - Validate request body structure
   - Validate message array format
   - Sanitize inputs if needed

## Testing

### Manual Testing

1. **Health Check**:
   ```bash
   curl http://localhost:3001/health
   ```

2. **Test Anthropic Endpoint**:
   ```bash
   curl -X POST http://localhost:3001/api/anthropic/messages \
     -H "Content-Type: application/json" \
     -d '{
       "messages": [
         {"role": "user", "content": "Hello, world!"}
       ]
     }'
   ```

### Test Cases

1. ✅ Valid request with messages
2. ✅ Request with system message
3. ✅ Request with custom model/temperature
4. ✅ Request without model (uses DEFAULT_AI_MODEL)
5. ✅ Provider routing (Anthropic, OpenAI, DeepSeek)
6. ✅ Model routing/override logic
7. ✅ Explicit provider specification
8. ✅ Missing messages array (400 error)
9. ✅ Invalid API key (401 error)
10. ✅ Unsupported provider (400 error)
11. ✅ Network timeout handling
12. ✅ Rate limit handling (429 error)

## Deployment

### Production Considerations

1. **Environment Variables**: Set `ANTHROPIC_API_KEY` in production environment
2. **CORS**: Update CORS origin to production frontend URL
3. **HTTPS**: Use HTTPS in production
4. **Error Logging**: Add proper logging (e.g., Winston, Pino)
5. **Monitoring**: Add health checks and monitoring
6. **Process Manager**: Use PM2 or similar for process management

### Example Production Setup

```javascript
// Production CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://yourdomain.com',
  credentials: true
}));

// Error logging
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

## Integration Checklist

- [ ] Create Express server
- [ ] Add `/api/anthropic/messages` endpoint
- [ ] Implement `getModelForRequest()` function for model abstraction
- [ ] Configure environment variables (including `DEFAULT_AI_MODEL`)
- [ ] Test endpoint manually
- [ ] Test model routing/override logic
- [ ] Update frontend `claudeService.ts` to use backend URL
- [ ] Remove API key from frontend code
- [ ] Test end-to-end from frontend
- [ ] Configure CORS for production
- [ ] Deploy backend
- [ ] Update frontend production URL
- [ ] Verify model abstraction works (change `DEFAULT_AI_MODEL` and test)

## Example Complete Server File

```javascript
// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Model abstraction: Get the model to use for this request
 */
function getModelForRequest(requestedModel) {
  if (requestedModel) {
    return requestedModel;
  }
  return process.env.DEFAULT_AI_MODEL || 'claude-sonnet-4-5-20250929';
}

// Anthropic proxy endpoint
app.post('/api/anthropic/messages', async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY not configured on server'
      });
    }

    const {
      model: requestedModel,
      max_tokens = 4096,
      temperature = 0.7,
      system,
      messages
    } = req.body;
    
    // Model abstraction: Determine which model to use
    const model = getModelForRequest(requestedModel);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'messages array is required and must not be empty'
      });
    }

    const requestBody = {
      model,
      max_tokens,
      temperature,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      ...(system && { system })
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errorData.error?.message || `API error: ${response.statusText}`,
        type: errorData.error?.type || 'api_error',
        statusCode: response.status
      });
    }

    const data = await response.json();
    const content = data.content
      ?.map((block) => block.text || block.content || '')
      .join('') || '';

    res.json({
      content,
      usage: data.usage ? {
        inputTokens: data.usage.input_tokens || 0,
        outputTokens: data.usage.output_tokens || 0
      } : undefined
    });

  } catch (error) {
    console.error('[Backend] Error:', error);
    
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return res.status(504).json({
        error: 'Request timed out. Please try again.',
        type: 'timeout'
      });
    }

    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      return res.status(503).json({
        error: 'Network error. Please check your connection.',
        type: 'network_error'
      });
    }

    return res.status(500).json({
      error: error.message || 'Internal server error',
      type: 'unknown'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`AI API endpoint: http://localhost:${PORT}/api/ai/messages`);
  console.log(`Supported providers: Anthropic, OpenAI, DeepSeek`);
});
```

## Next Steps

1. Create the backend project
2. Install dependencies: `npm install express cors dotenv`
3. Create `server.js` with the code above
4. Create `.env` with `ANTHROPIC_API_KEY`
5. Run: `node server.js`
6. Update frontend to use backend URL
7. Test end-to-end



