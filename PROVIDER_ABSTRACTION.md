# Provider Abstraction Guide

## Overview

The backend implements a **provider abstraction layer** that allows you to use different AI providers (Anthropic, OpenAI, DeepSeek, etc.) without changing frontend code. The backend automatically routes requests to the appropriate provider based on model name or configuration.

## Architecture

```
Frontend Request
    ↓ (model: "gpt-4" or "claude-sonnet-4-5-20250929" or "deepseek-chat")
Backend Provider Router
    ↓ (determines provider from model name)
Provider Implementation
    ├─→ Anthropic API
    ├─→ OpenAI API
    ├─→ DeepSeek API
    └─→ Other providers...
    ↓ (standardized response)
Backend
    ↓ (unified format)
Frontend
```

## Supported Providers

### Anthropic (Claude)
- **Models**: `claude-sonnet-4-5-20250929`, `claude-opus-3`, `claude-3-5-sonnet-20241022`
- **API Key**: `ANTHROPIC_API_KEY`
- **Endpoint**: `https://api.anthropic.com/v1/messages`

### OpenAI (GPT)
- **Models**: `gpt-4`, `gpt-3.5-turbo`, `o1-preview`, `o1-mini`
- **API Key**: `OPENAI_API_KEY`
- **Endpoint**: `https://api.openai.com/v1/chat/completions`

### DeepSeek
- **Models**: `deepseek-chat`, `deepseek-coder`
- **API Key**: `DEEPSEEK_API_KEY`
- **Endpoint**: `https://api.deepseek.com/v1/chat/completions`

## How Provider Selection Works

### Automatic Routing

The backend automatically determines the provider based on model name:

```javascript
function getProviderForModel(model) {
  const modelLower = model.toLowerCase();
  
  if (modelLower.includes('claude') || modelLower.includes('sonnet') || modelLower.includes('opus')) {
    return 'anthropic';
  }
  
  if (modelLower.includes('gpt') || modelLower.includes('o1')) {
    return 'openai';
  }
  
  if (modelLower.includes('deepseek')) {
    return 'deepseek';
  }
  
  return process.env.DEFAULT_AI_PROVIDER || 'anthropic';
}
```

### Examples

```javascript
// Frontend request
{
  model: "gpt-4"  // → Routes to OpenAI
}

{
  model: "claude-sonnet-4-5-20250929"  // → Routes to Anthropic
}

{
  model: "deepseek-chat"  // → Routes to DeepSeek
}

{
  model: "custom-model"  // → Uses DEFAULT_AI_PROVIDER
}
```

## Configuration

### Environment Variables

```env
# Provider API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...

# Default Configuration
DEFAULT_AI_MODEL=claude-sonnet-4-5-20250929
DEFAULT_AI_PROVIDER=anthropic
```

### Model-to-Provider Mapping

You can customize the provider routing logic:

```javascript
function getProviderForModel(model, requestedProvider) {
  // Use requested provider if specified
  if (requestedProvider) {
    return requestedProvider;
  }
  
  // Custom routing logic
  if (model.startsWith('gpt-')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('deepseek-')) return 'deepseek';
  
  // Default
  return process.env.DEFAULT_AI_PROVIDER || 'anthropic';
}
```

## Adding New Providers

### Step 1: Create Provider Module

Create `providers/newprovider.js`:

```javascript
export async function callNewProvider(apiKey, model, messages, options) {
  const response = await fetch('https://api.newprovider.com/v1/chat', {
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
    throw new Error(error.error?.message || 'NewProvider API error');
  }
  
  const data = await response.json();
  
  // Return standardized format
  return {
    content: data.choices[0]?.message?.content || '',
    usage: data.usage ? {
      inputTokens: data.usage.prompt_tokens || 0,
      outputTokens: data.usage.completion_tokens || 0
    } : undefined,
    provider: 'newprovider'
  };
}
```

### Step 2: Update Provider Router

```javascript
import { callNewProvider } from './providers/newprovider.js';

function getProviderForModel(model) {
  // ... existing logic ...
  
  if (modelLower.includes('newprovider')) {
    return 'newprovider';
  }
  
  // ...
}
```

### Step 3: Add to Main Endpoint

```javascript
case 'newprovider':
  apiKey = process.env.NEWPROVIDER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'NEWPROVIDER_API_KEY not configured'
    });
  }
  result = await callNewProvider(apiKey, model, messages, options);
  break;
```

### Step 4: Add Environment Variable

```env
NEWPROVIDER_API_KEY=your_key_here
```

## Provider-Specific Features

### Anthropic
- Supports `system` parameter separately
- System messages must be in separate field, not in messages array
- Response format: `{ content: [{ text: "..." }] }`

### OpenAI
- System messages can be in messages array with `role: "system"`
- Response format: `{ choices: [{ message: { content: "..." } }] }`

### DeepSeek
- Similar to OpenAI format
- Supports code generation models

## Standardized Response Format

All providers return the same format:

```typescript
{
  content: string                    // AI response text
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  provider?: string                  // Which provider was used
}
```

## Frontend Usage

The frontend is completely provider-agnostic:

```typescript
// Works with any provider
await sendMessage({
  model: 'gpt-4',  // Routes to OpenAI
  messages: [...]
});

await sendMessage({
  model: 'claude-sonnet-4-5-20250929',  // Routes to Anthropic
  messages: [...]
});

await sendMessage({
  model: 'deepseek-chat',  // Routes to DeepSeek
  messages: [...]
});
```

## Provider Routing Strategies

### 1. Model-Based Routing (Default)
```javascript
// Automatically routes based on model name
model: "gpt-4" → OpenAI
model: "claude-sonnet" → Anthropic
```

### 2. Explicit Provider
```javascript
// Frontend can specify provider
{
  model: "custom-model",
  provider: "openai"  // Force OpenAI
}
```

### 3. Configuration-Based
```javascript
// Route based on env config
if (process.env.USE_OPENAI === 'true') {
  return 'openai';
}
```

### 4. User-Based Routing
```javascript
// Route premium users to better provider
if (user.tier === 'premium') {
  return 'anthropic';  // Better quality
} else {
  return 'deepseek';  // More cost-effective
}
```

### 5. Cost-Based Routing
```javascript
// Route large requests to cheaper provider
if (estimatedTokens > 100000) {
  return 'deepseek';  // Cheaper for large contexts
}
```

## Benefits

✅ **Provider Flexibility**: Switch providers without frontend changes  
✅ **Cost Optimization**: Route requests to cheaper providers when appropriate  
✅ **Reliability**: Fallback to alternative providers if one fails  
✅ **A/B Testing**: Test different providers easily  
✅ **Vendor Lock-in Prevention**: Easy to switch providers  
✅ **Unified Interface**: Same API for all providers  

## Migration Examples

### Switching from Anthropic to OpenAI

1. Update backend `.env`:
   ```env
   DEFAULT_AI_MODEL=gpt-4
   DEFAULT_AI_PROVIDER=openai
   ```

2. Restart backend - done! Frontend needs no changes.

### Using Multiple Providers

1. Configure all provider API keys
2. Frontend can request different models:
   ```typescript
   // Uses OpenAI
   await sendMessage({ model: 'gpt-4', ... });
   
   // Uses Anthropic
   await sendMessage({ model: 'claude-sonnet-4-5-20250929', ... });
   ```

## Troubleshooting

### Provider Not Found
- Check model name matches provider pattern
- Verify `DEFAULT_AI_PROVIDER` is set correctly
- Check provider routing logic

### API Key Error
- Verify API key is set in backend `.env`
- Check key format (some providers have specific prefixes)
- Ensure key has correct permissions

### Response Format Mismatch
- Ensure provider implementation returns standardized format
- Check provider-specific response parsing

### Provider-Specific Errors
- Check provider API documentation
- Verify model name is valid for that provider
- Check rate limits and quotas

