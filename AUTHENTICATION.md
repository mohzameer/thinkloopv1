# Authentication Implementation Guide

This document explains the authentication system implemented in ThinkLoops.

## Overview

ThinkLoops uses Firebase Authentication with the following features:
- **Anonymous sign-in by default** - Users can start using the app immediately
- **Account upgrade** - Anonymous users can later create an account with email/password
- **Data preservation** - When upgrading, all existing data is preserved
- **Automatic default project** - Every user gets a default project upon sign-in

## Files

### Core Authentication
- `src/firebase/auth.ts` - Authentication helper functions
- `src/hooks/useAuth.ts` - React hook for authentication state
- `src/firebase/config.ts` - Firebase initialization

### Documentation
- `src/firebase/auth.example.ts` - Usage examples and patterns

## Authentication Flow

```
App Start
    ↓
Check if user exists
    ↓
    ├─ Yes → Load user data
    │
    └─ No → Sign in anonymously
         ↓
    Create user document
         ↓
    Create default project
         ↓
    User can start working
         ↓
    Later: Upgrade to email/password (optional)
         ↓
    All data preserved under same userId
```

## Key Functions

### `signInAnonymous()`
Automatically signs in the user anonymously and creates their user document and default project.

```typescript
const userId = await signInAnonymous()
```

### `upgradeAnonymousAccount(email, password, displayName?)`
Converts an anonymous account to a permanent email/password account while preserving all data.

```typescript
await upgradeAnonymousAccount('user@example.com', 'password', 'John Doe')
```

### `signInWithEmail(email, password)`
Signs in an existing user with email and password.

```typescript
const userId = await signInWithEmail('user@example.com', 'password')
```

### `createAccountWithEmail(email, password, displayName?)`
Creates a new account (not anonymous) with email and password.

```typescript
const userId = await createAccountWithEmail('user@example.com', 'password', 'Jane Doe')
```

### `signOut()`
Signs out the current user.

```typescript
await signOut()
```

### `getCurrentUser()` / `getCurrentUserId()`
Gets the current authenticated user or their ID.

```typescript
const user = getCurrentUser()
const userId = getCurrentUserId()
```

### `isAnonymous()`
Checks if the current user is anonymous.

```typescript
const anonymous = isAnonymous()
```

### `onAuthStateChanged(callback)`
Listens to authentication state changes.

```typescript
const unsubscribe = onAuthStateChanged((user) => {
  if (user) {
    console.log('User signed in:', user.uid)
  }
})

// Later: unsubscribe()
```

## Using the useAuth Hook

The easiest way to use authentication in your React components:

```typescript
import { useAuth } from './hooks/useAuth'

function MyComponent() {
  const { user, userId, isAnonymous, isLoading, isInitialized } = useAuth()

  if (isLoading || !isInitialized) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <p>User ID: {userId}</p>
      <p>Status: {isAnonymous ? 'Anonymous' : 'Registered'}</p>
    </div>
  )
}
```

### Hook Return Values

- `user` - Firebase user object (or null)
- `userId` - User ID string (or null)
- `isAnonymous` - Boolean indicating if user is anonymous
- `isLoading` - Boolean indicating if auth is being initialized
- `isInitialized` - Boolean indicating if auth setup is complete

## Integration with App.tsx

Wrap your main app component with authentication:

```typescript
import { useAuth } from './hooks/useAuth'
import CanvasPage from './components/CanvasPage'

function App() {
  const { userId, isLoading, isInitialized } = useAuth()

  if (isLoading || !isInitialized) {
    return <div>Loading...</div>
  }

  if (userId) {
    return <CanvasPage />
  }

  return <div>Please wait...</div>
}

export default App
```

## User Document Structure

Each user has a document in the `users` collection:

```typescript
{
  isAnonymous: boolean
  createdAt: Timestamp
  email?: string              // Only for registered users
  displayName?: string        // Optional
  updatedAt?: Timestamp       // Added when upgrading account
}
```

## Default Project

When a user signs in (anonymously or with email), a default project is automatically created:

```typescript
{
  userId: string
  name: 'Default Project'
  isDefault: true
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

## Error Handling

All authentication functions throw errors that can be caught:

```typescript
try {
  await upgradeAnonymousAccount(email, password)
} catch (error) {
  if (error.message.includes('already in use')) {
    // Handle email already registered
  } else {
    // Handle other errors
  }
}
```

Common error codes:
- `auth/credential-already-in-use` - Email already registered
- `auth/email-already-in-use` - Email in use
- `auth/weak-password` - Password too weak
- `auth/invalid-email` - Invalid email format
- `auth/user-not-found` - User doesn't exist
- `auth/wrong-password` - Incorrect password

## Security

- Anonymous users can only access their own data (enforced by Firestore security rules)
- Registered users can only access their own data
- When upgrading from anonymous to registered, the userId stays the same
- All data remains private and isolated per user

## Testing

To test the authentication:

1. **Test Anonymous Sign-In:**
   - Open the app
   - Check browser console for "User signed in anonymously"
   - Check Firebase Console > Authentication for the anonymous user

2. **Test Account Upgrade:**
   - While signed in anonymously, call `upgradeAnonymousAccount()`
   - Check that user is now registered with email
   - Verify data still exists in Firestore

3. **Test Sign Out:**
   - Call `signOut()`
   - User should be automatically signed in anonymously again

## Next Steps

After implementing authentication:
1. Create database helper functions for files, main items, and sub-items
2. Integrate with the Canvas UI
3. Add real-time listeners for data updates
4. Implement the version control sidebar with actual data

