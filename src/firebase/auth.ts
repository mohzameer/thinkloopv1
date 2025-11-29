import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updateProfile
} from 'firebase/auth'
import type { User as FirebaseUser } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './config'
import type { User } from '../types/firebase'

/**
 * Sign in anonymously and create user document if it doesn't exist
 * Also creates a default project for the user
 */
export const signInAnonymous = async (): Promise<string> => {
  try {
    console.log('[Auth] Signing in anonymously...')
    const userCredential = await signInAnonymously(auth)
    const userId = userCredential.user.uid
    console.log('[Auth] Anonymous sign-in successful:', userId)

    // Check if user document exists
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      console.log('[Auth] Creating new user document...')
      // Create user document
      const newUser: User = {
        isAnonymous: true,
        createdAt: serverTimestamp() as any
      }
      await setDoc(userRef, newUser)
      console.log('[Auth] User document created')

      // Create default project
      console.log('[Auth] Creating default project...')
      await createDefaultProject(userId)
      console.log('[Auth] Default project created')
    } else {
      console.log('[Auth] User document already exists')
    }

    return userId
  } catch (error) {
    console.error('[Auth] Error signing in anonymously:', error)
    throw error
  }
}

/**
 * Create a default project for a user
 */
export const createDefaultProject = async (userId: string): Promise<string> => {
  try {
    const { doc: docRef, setDoc: setDocFunc, collection } = await import('firebase/firestore')
    const projectRef = docRef(collection(db, 'projects'))
    
    console.log('[Auth] Creating default project for user:', userId)
    await setDocFunc(projectRef, {
      userId,
      name: 'Default Project',
      isDefault: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    console.log('[Auth] Default project created with ID:', projectRef.id)

    return projectRef.id
  } catch (error) {
    console.error('[Auth] Error creating default project:', error)
    throw error
  }
}

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<string> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    return userCredential.user.uid
  } catch (error) {
    console.error('Error signing in with email:', error)
    throw error
  }
}

/**
 * Create a new account with email and password
 */
export const createAccountWithEmail = async (
  email: string,
  password: string,
  displayName?: string
): Promise<string> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const userId = userCredential.user.uid

    // Update display name if provided
    if (displayName) {
      await updateProfile(userCredential.user, { displayName })
    }

    // Create user document
    const userRef = doc(db, 'users', userId)
    const newUser: User = {
      isAnonymous: false,
      createdAt: serverTimestamp() as any,
      email,
      displayName
    }
    await setDoc(userRef, newUser)

    // Create default project
    await createDefaultProject(userId)

    return userId
  } catch (error) {
    console.error('Error creating account with email:', error)
    throw error
  }
}

/**
 * Upgrade anonymous account to email/password account
 * This preserves all existing data under the same userId
 */
export const upgradeAnonymousAccount = async (
  email: string,
  password: string,
  displayName?: string
): Promise<string> => {
  try {
    const currentUser = auth.currentUser
    
    if (!currentUser) {
      throw new Error('No user is currently signed in')
    }

    if (!currentUser.isAnonymous) {
      throw new Error('Current user is not anonymous')
    }

    // Create credential
    const credential = EmailAuthProvider.credential(email, password)

    // Link credential to anonymous account
    const userCredential = await linkWithCredential(currentUser, credential)

    // Update display name if provided
    if (displayName) {
      await updateProfile(userCredential.user, { displayName })
    }

    // Update user document
    const userRef = doc(db, 'users', userCredential.user.uid)
    await setDoc(
      userRef,
      {
        isAnonymous: false,
        email,
        displayName,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    )

    return userCredential.user.uid
  } catch (error: any) {
    if (error.code === 'auth/credential-already-in-use') {
      throw new Error('This email is already in use by another account')
    } else if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email is already in use')
    }
    console.error('Error upgrading anonymous account:', error)
    throw error
  }
}

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth)
  } catch (error) {
    console.error('Error signing out:', error)
    throw error
  }
}

/**
 * Get the current user
 */
export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser
}

/**
 * Get the current user's ID
 */
export const getCurrentUserId = (): string | null => {
  return auth.currentUser?.uid || null
}

/**
 * Check if current user is anonymous
 */
export const isAnonymous = (): boolean => {
  return auth.currentUser?.isAnonymous || false
}

/**
 * Listen to authentication state changes
 * Returns an unsubscribe function
 */
export const onAuthStateChanged = (
  callback: (user: FirebaseUser | null) => void
): (() => void) => {
  return firebaseOnAuthStateChanged(auth, callback)
}

/**
 * Get user document from Firestore
 */
export const getUserDocument = async (userId: string): Promise<User | null> => {
  try {
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      return userSnap.data() as User
    }

    return null
  } catch (error) {
    console.error('Error getting user document:', error)
    throw error
  }
}

/**
 * Initialize authentication
 * Call this when the app starts
 */
export const initializeAuth = async (): Promise<string | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(async (user) => {
      unsubscribe() // Unsubscribe after first call

      if (user) {
        // User is already signed in
        resolve(user.uid)
      } else {
        // No user, sign in anonymously
        try {
          const userId = await signInAnonymous()
          resolve(userId)
        } catch (error) {
          console.error('Failed to initialize auth:', error)
          resolve(null)
        }
      }
    })
  })
}

