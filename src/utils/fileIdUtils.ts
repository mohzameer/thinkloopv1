/**
 * Utility functions for converting between full file IDs and short 6-character alphanumeric IDs
 */

const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/**
 * Generates a deterministic 6-character alphanumeric ID from a file ID
 * Uses a simple hash function to convert the file ID to a short string
 */
export function generateShortId(fileId: string): string {
  // Simple hash function
  let hash = 0
  for (let i = 0; i < fileId.length; i++) {
    const char = fileId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Convert to positive number and generate 6 characters
  const positiveHash = Math.abs(hash)
  let shortId = ''
  let num = positiveHash
  
  for (let i = 0; i < 6; i++) {
    shortId = ALPHANUMERIC[num % ALPHANUMERIC.length] + shortId
    num = Math.floor(num / ALPHANUMERIC.length)
  }
  
  return shortId
}

/**
 * Finds a file ID from a short ID by searching through available files
 * This is needed because the hash is one-way
 */
export function findFileIdByShortId(
  shortId: string,
  files: Array<{ id: string }>
): string | null {
  for (const file of files) {
    if (generateShortId(file.id) === shortId) {
      return file.id
    }
  }
  return null
}


