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
- **Authentication**: Firebase Admin SDK for token verification
- **Environment**: Use environment variables for API keys and Firebase config

### Project Structure
```
backend/
├── package.json
├── .env
├── .env.example
├── server.js (or index.js)
├── middleware/
│   └── auth.js (Firebase token verification middleware)
└── providers/
    ├── anthropic.js
    ├── openai.js
    ├── deepseek.js
    └── base.js (base provider interface)
```

## Authentication & Authorization

### Overview

The backend uses **Firebase Authentication** for user authentication. The frontend sends Firebase ID tokens in the `Authorization` header, and the backend verifies these tokens using the Firebase Admin SDK.

### Authentication Flow

```
Frontend (React)
    ↓
Firebase Auth: auth.currentUser.getIdToken()
    ↓
HTTP Request with Authorization: Bearer <firebase-id-token>
    ↓
Backend (Express)
    ↓
Firebase Admin SDK: verifyIdToken(token)
    ↓
Extract userId from decoded token
    ↓
Process request with authenticated user context
```

### Frontend Token Retrieval

The frontend must include the Firebase ID token in all API requests:

```typescript
import { getAuth } from 'firebase/auth'

// Get current user's ID token
const auth = getAuth()
const user = auth.currentUser

if (user) {
  const token = await user.getIdToken()
  
  // Include in API requests
  const response = await fetch(`${API_BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`  // ← Required
    },
    body: JSON.stringify(requestBody)
  })
}
```

### Backend Token Verification

**Install Firebase Admin SDK**:
```bash
npm install firebase-admin
```

**Initialize Firebase Admin**:
```javascript
// server.js or auth.js
import admin from 'firebase-admin'

// Initialize Firebase Admin SDK
// Option 1: Using service account JSON (recommended for production)
const serviceAccount = require('./path/to/serviceAccountKey.json')
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

// Option 2: Using environment variables (alternative)
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
  })
})
```

**Create Authentication Middleware**:
```javascript
// middleware/auth.js
import admin from 'firebase-admin'

/**
 * Middleware to verify Firebase ID token
 * Extracts userId from token and attaches to request object
 */
export async function verifyFirebaseToken(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or invalid Authorization header',
        type: 'unauthorized'
      })
    }
    
    const token = authHeader.split('Bearer ')[1]
    
    // Verify token with Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token)
    
    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      isAnonymous: decodedToken.firebase.sign_in_provider === 'anonymous'
    }
    
    // Continue to next middleware/route
    next()
  } catch (error) {
    console.error('[Auth] Token verification failed:', error)
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Token expired. Please refresh and try again.',
        type: 'token_expired'
      })
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        error: 'Token revoked. Please sign in again.',
        type: 'token_revoked'
      })
    }
    
    return res.status(401).json({
      error: 'Invalid or expired token',
      type: 'unauthorized'
    })
  }
}
```

**Apply Middleware to Protected Routes**:
```javascript
// server.js
import { verifyFirebaseToken } from './middleware/auth.js'

// Apply to all API routes
app.use('/api', verifyFirebaseToken)

// Or apply to specific routes
app.post('/api/ai/messages', verifyFirebaseToken, async (req, res) => {
  // req.user.uid is available here
  const userId = req.user.uid
  // ... process request
})
```

### Request Headers (All Protected Endpoints)

All API endpoints require the following header:

```
Authorization: Bearer <firebase-id-token>
```

**Example**:
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1NiIsInR5cCI6IkpXVCJ9...
```

### Response Codes

- **200 OK**: Request successful, user authenticated
- **401 Unauthorized**: Missing, invalid, or expired token
- **403 Forbidden**: Token valid but user lacks permission (if implementing role-based access)

### Error Responses

**Missing Token**:
```json
{
  "error": "Missing or invalid Authorization header",
  "type": "unauthorized"
}
```

**Invalid/Expired Token**:
```json
{
  "error": "Invalid or expired token",
  "type": "unauthorized"
}
```

**Token Expired** (specific):
```json
{
  "error": "Token expired. Please refresh and try again.",
  "type": "token_expired"
}
```

### User Context in Requests

After token verification, the `req.user` object is available in all route handlers:

```javascript
app.post('/api/ai/messages', verifyFirebaseToken, async (req, res) => {
  const userId = req.user.uid           // Firebase user ID
  const userEmail = req.user.email      // User email (if not anonymous)
  const isAnonymous = req.user.isAnonymous  // true if anonymous user
  
  // Use userId for logging, rate limiting, etc.
  console.log(`Request from user: ${userId}`)
  
  // ... process request
})
```

### Anonymous Users

Firebase supports anonymous authentication. Anonymous users:
- Have valid Firebase ID tokens
- Can access all API endpoints (if your business logic allows)
- Can be upgraded to registered users later (handled by frontend)

**Check if user is anonymous**:
```javascript
if (req.user.isAnonymous) {
  // Handle anonymous user (e.g., rate limiting, feature restrictions)
}
```

### Security Best Practices

1. **Always verify tokens server-side**: Never trust client-provided user IDs
2. **Use HTTPS in production**: Tokens should only be sent over encrypted connections
3. **Token expiration**: Firebase tokens expire after 1 hour. Frontend should refresh tokens automatically
4. **Rate limiting**: Implement rate limiting per userId to prevent abuse
5. **Logging**: Log userId with all requests for audit trails

### Environment Variables

Add to backend `.env`:

```env
# Firebase Admin SDK (Service Account)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# OR use service account JSON file path
FIREBASE_SERVICE_ACCOUNT_PATH=./path/to/serviceAccountKey.json
```

### Getting Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file
6. Store securely (never commit to git)

### Testing Authentication

**Test with valid token**:
```bash
# Get token from frontend (browser console)
const token = await firebase.auth().currentUser.getIdToken()

# Use in curl
curl -X POST http://localhost:3001/api/ai/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

**Test without token** (should fail):
```bash
curl -X POST http://localhost:3001/api/ai/messages \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
# Expected: 401 Unauthorized
```

## API Endpoint Specification

### Endpoint: `POST /api/ai/messages`

**Purpose**: Provider-agnostic AI API endpoint that routes to appropriate provider based on model or configuration

**Authentication**: Required (Firebase ID token)

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <firebase-id-token>
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
# AI Provider API Keys
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEFAULT_AI_MODEL=claude-sonnet-4-5-20250929
DEFAULT_AI_PROVIDER=anthropic

# Firebase Admin SDK (Service Account)
# Option 1: Use service account JSON file path
FIREBASE_SERVICE_ACCOUNT_PATH=./path/to/serviceAccountKey.json

# Option 2: Use individual credentials (alternative)
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:5173
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
    "dotenv": "^16.3.1",
    "firebase-admin": "^12.0.0"
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

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply authentication middleware to all API routes
// Import the middleware (see Authentication & Authorization section above)
import { verifyFirebaseToken } from './middleware/auth.js'
app.use('/api', verifyFirebaseToken)

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
// Note: verifyFirebaseToken middleware is already applied via app.use('/api', ...)
// req.user.uid is available after authentication
app.post('/api/anthropic/messages', async (req, res) => {
  try {
    // User is authenticated at this point (via middleware)
    const userId = req.user.uid
    console.log(`[API] Request from user: ${userId}`)
    
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

---

## Export API Endpoints

### Overview

The export feature allows users to export diagram content in various formats (text, markdown, PDF). The backend handles:
1. **AI-generated context** - Derives comprehensive context from diagram nodes using AI
2. **PDF generation** - Converts text/markdown content to PDF format

**Note**: Copy as text and copy as markdown are handled client-side and don't require backend endpoints.

### Endpoint: `POST /api/export/generate-context`

**Purpose**: Generate AI-derived context from diagram nodes for export. This context is one per file and should be cached/saved by the frontend to Firestore.

**Authentication**: Required (Firebase ID token)

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <firebase-id-token>
```

**Request Body**:
```typescript
{
  nodes: Array<{
    id: string
    type?: string
    data: {
      label: string
      categories?: string[]
      tags?: Array<{ name: string; color: string }>
    }
    position?: { x: number; y: number }
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    data?: {
      label?: string
    }
  }>
  fileId: string                    // For caching/reference
}
```

**Node Filtering Rules**:
- **Exclude nodes** that contain "Idea node" or "thinking node" (case-insensitive) in their label
- Only process nodes that pass the filter

**Processing Steps**:
1. Filter out excluded nodes (Idea node, thinking node)
2. Build an outline of all remaining nodes with their content
3. Include edge relationships and labels
4. Send outline to AI to generate comprehensive context
5. Return the AI-generated context

**Response Headers**:
```
Content-Type: application/json
```

**Success Response** (200 OK):
```typescript
{
  context: string                   // AI-generated comprehensive context
  outline?: string                  // Optional: the raw outline sent to AI (for debugging)
  nodeCount: number                 // Number of nodes processed (after filtering)
  edgeCount: number                 // Number of edges processed
}
```

**Error Response** (4xx/5xx):
```typescript
{
  error: string
  type?: string
  statusCode?: number
}
```

**Example Request**:
```json
{
  "nodes": [
    {
      "id": "node1",
      "type": "rectangle",
      "data": {
        "label": "Main Concept: Machine Learning"
      },
      "position": { "x": 100, "y": 200 }
    },
    {
      "id": "node2",
      "type": "circle",
      "data": {
        "label": "Idea node: Random thought"
      }
    }
  ],
  "edges": [
    {
      "id": "edge1",
      "source": "node1",
      "target": "node2",
      "data": {
        "label": "relates to"
      }
    }
  ],
  "fileId": "file123"
}
```

**Example Response**:
```json
{
  "context": "# Machine Learning Overview\n\nThis diagram explores the concept of Machine Learning...",
  "nodeCount": 1,
  "edgeCount": 1
}
```

**Implementation Notes**:
- Use the same AI provider abstraction as `/api/ai/messages`
- System prompt should instruct AI to create comprehensive, well-structured summaries
- If AI fails, fallback to returning the raw outline
- Consider caching results per fileId to avoid regenerating context unnecessarily

---

### Endpoint: `POST /api/export/generate-pdf`

**Purpose**: Convert text or markdown content to PDF format for download.

**Authentication**: Required (Firebase ID token)

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <firebase-id-token>
```

**Request Body**:
```typescript
{
  content: string                   // Text or markdown content to convert
  format: "text" | "markdown"      // Format of the input content
  title?: string                    // Optional: PDF title
  fileName?: string                 // Optional: suggested filename (default: "export.pdf")
}
```

**Response Headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="export.pdf"
```

**Success Response** (200 OK):
- Binary PDF file content

**Error Response** (4xx/5xx):
```typescript
{
  error: string
  type?: string
  statusCode?: number
}
```

**Example Request**:
```json
{
  "content": "# My Document\n\nThis is the content...",
  "format": "markdown",
  "title": "My Export",
  "fileName": "my-export.pdf"
}
```

**Implementation Notes**:
- Use a PDF generation library like `pdfkit`, `puppeteer`, or `jsPDF` (server-side)
- For markdown, convert to HTML first, then to PDF
- Support proper formatting: headings, lists, code blocks, etc.
- Set appropriate page margins and styling
- Handle long content with page breaks

**Recommended Libraries**:
- **pdfkit** (Node.js): Good for programmatic PDF generation
- **puppeteer** (Node.js): Renders HTML/CSS to PDF (best for markdown)
- **marked** + **puppeteer**: Convert markdown → HTML → PDF

**Example Implementation (using puppeteer)**:
```javascript
import puppeteer from 'puppeteer';
import { marked } from 'marked';

app.post('/api/export/generate-pdf', async (req, res) => {
  try {
    const { content, format, title, fileName } = req.body;
    
    let html = '';
    if (format === 'markdown') {
      html = marked(content);
    } else {
      html = `<pre>${content}</pre>`;
    }
    
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${title || 'Export'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            h1, h2, h3 { color: #333; }
            pre { background: #f5f5f5; padding: 10px; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `;
    
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(fullHtml);
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'export.pdf'}"`);
    res.send(pdf);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Export Feature Frontend Integration

### Client-Side Functions (No Backend Required)

1. **Copy as Text**: 
   - Simply copy the context string to clipboard using `navigator.clipboard.writeText()`
   - No backend call needed

2. **Copy as Markdown**:
   - If context is already markdown, copy directly
   - If context is plain text, wrap in markdown code blocks or convert
   - Use `navigator.clipboard.writeText()` with markdown content

3. **Download PDF**:
   - Call `POST /api/export/generate-pdf` with content and format
   - Receive PDF binary response
   - Create blob and trigger download

### Context Caching

- **Save context to Firestore**: After generating context, save it to the file document's `exportContext` field
- **Check cache first**: Before calling `/api/export/generate-context`, check if `exportContext` exists in Firestore
- **Regenerate on demand**: Provide option to regenerate context if diagram has changed
- **One context per file**: Context is stored at the file level, not per sub-item

### Frontend Flow

```
1. User clicks Export button
2. Check Firestore for existing exportContext
3. If exists:
   - Use cached context
4. If not exists or user requests regeneration:
   - Call POST /api/export/generate-context with nodes/edges
   - Save response.context to Firestore exportContext field
   - Use the context
5. Show modal with context in textarea
6. User clicks action button:
   - Copy as Text: navigator.clipboard.writeText(context)
   - Copy as Markdown: navigator.clipboard.writeText(markdownContext)
   - Download PDF: POST /api/export/generate-pdf → download blob
```



