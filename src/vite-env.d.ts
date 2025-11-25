/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Backend API URL (e.g., http://localhost:3001 or https://api.yourdomain.com)
  readonly VITE_BACKEND_URL?: string
  // Optional: Default AI model (backend can override)
  readonly VITE_AI_MODEL?: string
  // Add other env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

