/**
 * AUTHENTICATION HELPER FUNCTIONS - USAGE EXAMPLES
 * 
 * This file contains examples of how to use the authentication functions.
 * DO NOT import this file in your app - it's for reference only.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  signInAnonymous,
  signInWithEmail,
  createAccountWithEmail,
  upgradeAnonymousAccount,
  signOut,
  getCurrentUser,
  getCurrentUserId,
  isAnonymous,
  onAuthStateChanged,
  getUserDocument
} from './auth'

// ============================================================================
// EXAMPLE 1: Initial App Load (Automatic Anonymous Sign-In)
// ============================================================================
// This happens automatically when you use the useAuth hook
// See: src/hooks/useAuth.ts

export async function _example1_InitialLoad() {
  // The useAuth hook handles this automatically
  // But if you need to manually initialize:
  
  const userId = await signInAnonymous()
  console.log('User signed in anonymously:', userId)
  // User document and default project are created automatically
}

// ============================================================================
// EXAMPLE 2: Check Current User Status
// ============================================================================

export function _example2_CheckCurrentUser() {
  const user = getCurrentUser()
  
  if (user) {
    console.log('User ID:', user.uid)
    console.log('Is Anonymous:', user.isAnonymous)
    console.log('Email:', user.email)
  } else {
    console.log('No user signed in')
  }

  // Or just get the user ID
  void getCurrentUserId()
  
  // Check if user is anonymous
  void isAnonymous()
}

// ============================================================================
// EXAMPLE 3: Listen to Auth State Changes
// ============================================================================

export function _example3_ListenToAuthChanges() {
  // Subscribe to auth state changes
  const unsubscribe = onAuthStateChanged((user) => {
    if (user) {
      console.log('User signed in:', user.uid)
      console.log('Is anonymous:', user.isAnonymous)
      
      // Update your app state here
      // loadUserData(user.uid)
    } else {
      console.log('User signed out')
      // Clear your app state here
    }
  })

  // Later, when component unmounts:
  // unsubscribe()
  
  return unsubscribe
}

// ============================================================================
// EXAMPLE 4: Upgrade Anonymous Account to Email/Password
// ============================================================================

export async function _example4_UpgradeAnonymousAccount() {
  try {
    // Check if user is anonymous first
    if (!isAnonymous()) {
      console.log('User is already registered')
      return
    }

    // Upgrade the account
    const userId = await upgradeAnonymousAccount(
      'user@example.com',
      'securePassword123',
      'John Doe' // Optional display name
    )

    console.log('Account upgraded successfully:', userId)
    // All existing data (projects, files, etc.) is preserved!
    
  } catch (error: any) {
    if (error.message.includes('already in use')) {
      console.error('This email is already registered')
      // Show error to user: "Email already in use"
    } else {
      console.error('Failed to upgrade account:', error)
    }
  }
}

// ============================================================================
// EXAMPLE 5: Create New Account (Not Anonymous)
// ============================================================================

export async function _example5_CreateNewAccount() {
  try {
    const userId = await createAccountWithEmail(
      'newuser@example.com',
      'securePassword123',
      'Jane Doe' // Optional display name
    )

    console.log('Account created successfully:', userId)
    // User document and default project are created automatically
    
  } catch (error: any) {
    console.error('Failed to create account:', error)
    // Handle errors: email already in use, weak password, etc.
  }
}

// ============================================================================
// EXAMPLE 6: Sign In with Existing Email/Password
// ============================================================================

export async function _example6_SignInWithEmail() {
  try {
    const userId = await signInWithEmail(
      'user@example.com',
      'securePassword123'
    )

    console.log('Signed in successfully:', userId)
    
  } catch (error: any) {
    console.error('Failed to sign in:', error)
    // Handle errors: wrong password, user not found, etc.
  }
}

// ============================================================================
// EXAMPLE 7: Sign Out
// ============================================================================

export async function _example7_SignOut() {
  try {
    await signOut()
    console.log('Signed out successfully')
    // User will be automatically signed in anonymously again
    // (if you're using the useAuth hook)
    
  } catch (error) {
    console.error('Failed to sign out:', error)
  }
}

// ============================================================================
// EXAMPLE 8: Get User Document from Firestore
// ============================================================================

export async function _example8_GetUserDocument() {
  const userId = getCurrentUserId()
  
  if (userId) {
    const userDoc = await getUserDocument(userId)
    
    if (userDoc) {
      console.log('User document:', userDoc)
      console.log('Is Anonymous:', userDoc.isAnonymous)
      console.log('Email:', userDoc.email)
      console.log('Display Name:', userDoc.displayName)
    }
  }
}

// ============================================================================
// EXAMPLE 9: Using the useAuth Hook in a React Component
// ============================================================================

/*
import { useAuth } from '../hooks/useAuth'

function MyComponent() {
  const { user, userId, isAnonymous, isLoading, isInitialized } = useAuth()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!isInitialized) {
    return <div>Initializing...</div>
  }

  return (
    <div>
      <h1>Welcome!</h1>
      <p>User ID: {userId}</p>
      <p>Status: {isAnonymous ? 'Anonymous' : 'Registered'}</p>
      
      {isAnonymous ? (
        <button onClick={handleUpgradeAccount}>
          Create Account
        </button>
      ) : (
        <button onClick={handleSignOut}>
          Sign Out
        </button>
      )}
    </div>
  )
}

async function handleUpgradeAccount() {
  const email = prompt('Enter your email:')
  const password = prompt('Enter your password:')
  
  if (email && password) {
    try {
      await upgradeAnonymousAccount(email, password)
      alert('Account created successfully!')
    } catch (error) {
      alert('Failed to create account')
    }
  }
}

async function handleSignOut() {
  try {
    await signOut()
    alert('Signed out successfully!')
  } catch (error) {
    alert('Failed to sign out')
  }
}
*/

// ============================================================================
// EXAMPLE 10: Complete Authentication Flow in App.tsx
// ============================================================================

/*
import { useAuth } from './hooks/useAuth'
import CanvasPage from './components/CanvasPage'

function App() {
  const { userId, isLoading, isInitialized } = useAuth()

  // Show loading state while initializing authentication
  if (isLoading || !isInitialized) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Loading...</div>
      </div>
    )
  }

  // Once authenticated (anonymous or registered), show the app
  if (userId) {
    return <CanvasPage />
  }

  // Fallback (should rarely reach here)
  return <div>Please wait...</div>
}

export default App
*/

