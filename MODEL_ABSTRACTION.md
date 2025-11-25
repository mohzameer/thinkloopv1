# Model Abstraction Guide

## Overview

The backend implements a **model abstraction layer** that allows you to swap AI models without changing frontend code. This provides flexibility for:
- Model upgrades/downgrades
- A/B testing different models
- Routing users to different models (premium vs free)
- Handling model outages/maintenance
- Cost optimization

## Architecture

```
Frontend Request
    ↓ (optional model parameter)
Backend getModelForRequest()
    ↓ (determines final model)
Anthropic API
    ↓ (response)
Backend
    ↓ (response)
Frontend
```

## Backend Implementation

### Basic Model Selection

```javascript
function getModelForRequest(requestedModel) {
  // Option 1: Use requested model if provided
  if (requestedModel) {
    return requestedModel;
  }
  
  // Option 2: Use default from environment
  if (process.env.DEFAULT_AI_MODEL) {
    return process.env.DEFAULT_AI_MODEL;
  }
  
  // Option 3: Fallback to hardcoded default
  return 'claude-sonnet-4-5-20250929';
}
```

### Advanced Model Routing

```javascript
function getModelForRequest(requestedModel, userId, requestMetadata) {
  // Premium users get better model
  if (isPremiumUser(userId)) {
    return process.env.PREMIUM_MODEL || 'claude-opus-3';
  }
  
  // Specific request types use specific models
  if (requestMetadata?.type === 'code-generation') {
    return 'claude-3-5-sonnet-20241022';
  }
  
  if (requestMetadata?.type === 'analysis') {
    return 'claude-sonnet-4-5-20250929';
  }
  
  // Use requested model if provided
  if (requestedModel) {
    return requestedModel;
  }
  
  // Default from env
  return process.env.DEFAULT_AI_MODEL || 'claude-sonnet-4-5-20250929';
}
```

### Model Override Examples

#### Example 1: Force Model for Testing
```javascript
// In .env
DEFAULT_AI_MODEL=claude-3-5-sonnet-20241022

// All requests will use this model (unless frontend specifies one)
```

#### Example 2: Route by User Tier
```javascript
function getModelForRequest(requestedModel, userId) {
  const user = getUserById(userId);
  
  if (user?.tier === 'premium') {
    return 'claude-opus-3';
  }
  
  if (user?.tier === 'enterprise') {
    return 'claude-opus-3';
  }
  
  return requestedModel || process.env.DEFAULT_AI_MODEL || 'claude-sonnet-4-5-20250929';
}
```

#### Example 3: A/B Testing
```javascript
function getModelForRequest(requestedModel, userId) {
  // A/B test: 50% get new model, 50% get old model
  const hash = hashUserId(userId);
  const useNewModel = hash % 2 === 0;
  
  if (useNewModel) {
    return process.env.AB_TEST_MODEL || 'claude-3-5-sonnet-20241022';
  }
  
  return requestedModel || process.env.DEFAULT_AI_MODEL || 'claude-sonnet-4-5-20250929';
}
```

#### Example 4: Cost Optimization
```javascript
function getModelForRequest(requestedModel, requestSize) {
  // Use cheaper model for large requests
  const estimatedTokens = estimateTokens(requestSize);
  
  if (estimatedTokens > 100000) {
    return 'claude-3-5-sonnet-20241022'; // Cheaper for large contexts
  }
  
  return requestedModel || process.env.DEFAULT_AI_MODEL || 'claude-sonnet-4-5-20250929';
}
```

## Environment Variables

### Backend `.env`
```env
# Default model (used when frontend doesn't specify)
DEFAULT_AI_MODEL=claude-sonnet-4-5-20250929

# Optional: Model for specific use cases
PREMIUM_MODEL=claude-opus-3
CODE_MODEL=claude-3-5-sonnet-20241022
AB_TEST_MODEL=claude-3-5-sonnet-20241022
```

### Frontend `.env.local`
```env
# Optional: Default model (backend can override)
# VITE_AI_MODEL=claude-sonnet-4-5-20250929
```

## Available Models

### Anthropic Claude Models

| Model | Use Case | Context Window | Cost |
|-------|----------|----------------|------|
| `claude-sonnet-4-5-20250929` | General purpose, latest | 200k | Standard |
| `claude-opus-3` | Premium, highest quality | 200k | Higher |
| `claude-3-5-sonnet-20241022` | Fast, cost-effective | 200k | Lower |
| `claude-3-opus-20240229` | Previous premium | 200k | Higher |
| `claude-3-sonnet-20240229` | Previous standard | 200k | Standard |

**Note**: Check [Anthropic's documentation](https://docs.anthropic.com/claude/docs/models-overview) for the latest available models.

## Usage Examples

### Change Model in Production

1. Update backend `.env`:
   ```env
   DEFAULT_AI_MODEL=claude-3-5-sonnet-20241022
   ```

2. Restart backend (or reload env vars)

3. All new requests will use the new model (no frontend deployment needed)

### Test Different Models

1. Set `DEFAULT_AI_MODEL` to test model
2. Make requests
3. Compare results
4. Switch back if needed

### Route Premium Users

```javascript
// In backend endpoint
const userId = req.headers['x-user-id']; // Or from auth token
const model = getModelForRequest(req.body.model, userId);

// Premium users get better model automatically
```

## Frontend Integration

The frontend can optionally specify a model:

```typescript
// Option 1: Let backend decide (recommended)
await sendMessage({
  messages: [...],
  // No model specified - backend uses DEFAULT_AI_MODEL
});

// Option 2: Request specific model (backend can still override)
await sendMessage({
  model: 'claude-3-5-sonnet-20241022',
  messages: [...],
});
```

## Benefits

✅ **No Frontend Deployment**: Change models by updating backend env vars  
✅ **Flexible Routing**: Route users/requests to different models  
✅ **A/B Testing**: Easy to test different models  
✅ **Cost Control**: Route large requests to cheaper models  
✅ **Maintenance**: Switch models during outages  
✅ **User Tiers**: Premium users get better models automatically  

## Migration Guide

### From Hardcoded Model to Abstraction

**Before**:
```javascript
const model = 'claude-sonnet-4-5-20250929'; // Hardcoded
```

**After**:
```javascript
const model = getModelForRequest(requestedModel); // Abstracted
```

### Testing Model Changes

1. Set `DEFAULT_AI_MODEL` to new model
2. Test with sample requests
3. Monitor performance/cost
4. Rollback if needed (change env var back)

## Troubleshooting

### Model Not Changing

- Check `DEFAULT_AI_MODEL` is set in backend `.env`
- Verify backend restarted after env change
- Check `getModelForRequest()` logic
- Verify frontend isn't hardcoding model

### Wrong Model Being Used

- Check if frontend is passing model in request
- Verify routing logic in `getModelForRequest()`
- Check env var is loaded correctly

### Model Not Found Error

- Verify model name is correct (check Anthropic docs)
- Ensure API key has access to that model
- Check model is available in your region

