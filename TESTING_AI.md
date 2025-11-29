# Testing AI Features

## Quick Start

### 1. Backend Setup

Make sure your backend is running on `http://localhost:3001/`:

```bash
# In your backend directory
npm start
# or
node server.js
```

Verify backend is running:
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok"}
```

### 2. Frontend Configuration

The `.env.local` file should have:
```env
VITE_BACKEND_URL=http://localhost:3001
```

**Important**: Restart your Vite dev server after updating `.env.local`:
```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

### 3. Backend API Key Configuration

Make sure your backend `.env` file has the API keys for the providers you want to use:

```env
# At minimum, configure one provider
ANTHROPIC_API_KEY=your_anthropic_key_here
# OR
OPENAI_API_KEY=your_openai_key_here
# OR
DEEPSEEK_API_KEY=your_deepseek_key_here

# Optional: Set default model
DEFAULT_AI_MODEL=claude-sonnet-4-5-20250929
DEFAULT_AI_PROVIDER=anthropic
```

### 4. Testing in the App

1. **Open the canvas page** in your browser
2. **Open the chat/notes sidebar** (if collapsed)
3. **Type a message** in the chat input, for example:
   - "Add a node called 'Main Topic'"
   - "What are the relationships between these nodes?"
   - "Explain the structure of this canvas"

4. **Check the browser console** for debug logs:
   - `[AI Service] Sending request to: http://localhost:3001/api/ai/messages`
   - `[AI Service] Response status: 200 OK`
   - `[AI Service] Response data: { hasContent: true, ... }`

### 5. Troubleshooting

#### Backend Not Found Error
```
Network error. Please check your connection.
```

**Solution:**
- Verify backend is running: `curl http://localhost:3001/health`
- Check `VITE_BACKEND_URL` in `.env.local` is `http://localhost:3001`
- Restart frontend dev server after changing `.env.local`

#### CORS Error
```
Cross-Origin Request Blocked
```

**Solution:**
- Make sure backend CORS is configured to allow your frontend URL
- Check backend logs for CORS errors
- Verify backend is running on the correct port

#### API Key Error
```
Authentication failed. Please check backend API key configuration.
```

**Solution:**
- Check backend `.env` file has the API key set
- Verify API key is valid (test with curl)
- Check backend logs for specific error messages

#### 401 Unauthorized
```
Invalid API key
```

**Solution:**
- Verify API key in backend `.env` is correct
- Check API key hasn't expired
- Ensure API key has proper permissions

#### 500 Internal Server Error
```
API error (500). Please try again.
```

**Solution:**
- Check backend logs for detailed error
- Verify provider API key is configured
- Check if model name is valid for the provider

### 6. Testing Different Providers

#### Test Anthropic (Claude)
```typescript
// In browser console or test file
await sendMessage({
  model: 'claude-sonnet-4-5-20250929',
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

#### Test OpenAI (GPT)
```typescript
await sendMessage({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

#### Test DeepSeek
```typescript
await sendMessage({
  model: 'deepseek-chat',
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

### 7. Debug Logging

The frontend includes debug logging in development mode. Check the browser console for:

- **Request URL**: Shows where the request is being sent
- **Request Body**: Shows the model and message count
- **Response Status**: Shows HTTP status code
- **Response Data**: Shows if content was received and which provider was used

### 8. Manual Backend Test

Test the backend directly:

```bash
# Test Anthropic
curl -X POST http://localhost:3001/api/ai/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "messages": [
      {"role": "user", "content": "Say hello!"}
    ]
  }'

# Test OpenAI
curl -X POST http://localhost:3001/api/ai/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Say hello!"}
    ]
  }'
```

Expected response:
```json
{
  "content": "Hello! How can I help you?",
  "usage": {
    "inputTokens": 10,
    "outputTokens": 8
  },
  "provider": "anthropic"
}
```

### 9. Common Issues

#### Issue: "Failed to fetch"
- **Cause**: Backend not running or wrong URL
- **Fix**: Start backend, verify URL in `.env.local`

#### Issue: Empty response
- **Cause**: Backend returned empty content
- **Fix**: Check backend logs, verify API key works

#### Issue: Wrong provider used
- **Cause**: Model name doesn't match provider pattern
- **Fix**: Specify `provider` in request or check model name

#### Issue: Timeout
- **Cause**: Request taking too long (>60s)
- **Fix**: Check backend/API is responding, increase timeout if needed

### 10. Next Steps

Once basic testing works:
1. Test adding nodes via AI
2. Test querying relationships
3. Test different models
4. Test provider switching
5. Test error handling

