import { useState, useEffect } from 'react'
import type { User as FirebaseUser } from 'firebase/auth'
import { onAuthStateChanged, signInAnonymous } from '../firebase/auth'

interface AuthState {
  user: FirebaseUser | null
  userId: string | null
  isAnonymous: boolean
  isLoading: boolean
  isInitialized: boolean
}

/**
 * React hook for authentication state
 * Automatically signs in anonymously if no user is signed in
 */
export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    userId: null,
    isAnonymous: false,
    isLoading: true,
    isInitialized: false
  })

  useEffect(() => {
    console.log('[useAuth] Initializing authentication...')
    
    // Set up auth state listener first
    const unsubscribe = onAuthStateChanged(async (user) => {
      console.log('[useAuth] Auth state changed:', user ? `User ${user.uid} (anonymous: ${user.isAnonymous})` : 'No user')
      
      if (user) {
        // User exists (either anonymous or authenticated)
        setAuthState({
          user,
          userId: user.uid,
          isAnonymous: user.isAnonymous,
          isLoading: false,
          isInitialized: true
        })
      } else {
        // No user, sign in anonymously
        console.log('[useAuth] No user found, signing in anonymously...')
        try {
          const userId = await signInAnonymous()
          console.log('[useAuth] Anonymous sign-in successful:', userId)
          // The onAuthStateChanged listener will be triggered again with the new user
        } catch (error) {
          console.error('[useAuth] Failed to sign in anonymously:', error)
          setAuthState({
            user: null,
            userId: null,
            isAnonymous: false,
            isLoading: false,
            isInitialized: true
          })
        }
      }
    })

    // Cleanup
    return () => {
      console.log('[useAuth] Cleaning up auth listener')
      unsubscribe()
    }
  }, [])

  return authState
}

