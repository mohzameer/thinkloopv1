# AI Agent Setup Guide

## Environment Variables

### Anthropic API Key Setup

1. Get your API key from [Anthropic Console](https://console.anthropic.com/)

2. Add the API key to your `.env.local` file:
   ```bash
   VITE_ANTHROPIC_API_KEY=your_actual_api_key_here
   ```

3. The `.env.local` file is already in `.gitignore`, so your API key won't be committed to git.

4. Restart your Vite dev server after adding the key.

### Verifying Setup

The API key will be accessible in your code via:
```typescript
const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
```

### Troubleshooting

- **Key not found**: Make sure the variable name starts with `VITE_`
- **Still not working**: Restart the dev server after adding the key
- **CORS Error**: The Vite dev server includes a proxy to handle CORS. Make sure you restart the dev server after any changes.
- **Production**: 
  - ⚠️ **Important**: For production, you'll need a backend API route to proxy requests to Anthropic API
  - The current setup exposes the API key in the frontend (acceptable for development, not for production)
  - Create a backend endpoint (e.g., `/api/anthropic`) that:
    - Receives requests from the frontend
    - Adds the API key server-side
    - Forwards requests to Anthropic API
    - Returns the response to the frontend
  - Update `claudeService.ts` to use your production API endpoint instead of direct Anthropic calls

