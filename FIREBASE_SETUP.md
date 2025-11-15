# Firebase Setup Guide

## 1. Firebase Console Setup

### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Follow the setup wizard

### Enable Authentication
1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Anonymous** sign-in
3. Enable **Email/Password** sign-in (for future account upgrades)

### Create Firestore Database
1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Choose **Start in production mode** (we have custom rules)
4. Select your region

### Deploy Security Rules
1. Install Firebase CLI globally (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in your project:
   ```bash
   firebase init firestore
   ```
   - Select your Firebase project
   - Keep `firestore.rules` as the rules file
   - Skip firestore.indexes.json for now

4. Deploy the security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Get Firebase Configuration
1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click the web icon (`</>`) to create a web app
4. Register your app with a nickname (e.g., "ThinkPost Web")
5. Copy the `firebaseConfig` object values

## 2. Local Environment Setup

### Create .env.local file
Create a `.env.local` file in the project root with your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Note:** `.env.local` is already in `.gitignore` and won't be committed.

### Install Firebase SDK
```bash
npm install firebase
```

## 3. Database Structure

### Collections Hierarchy
```
users/
  {userId}/

projects/
  {projectId}/

files/
  {fileId}/
    mainItems/
      {mainItemId}/
        subItems/
          {subItemId}/
```

### Data Models

See `src/types/firebase.ts` for complete TypeScript interfaces.

#### User Document
```typescript
{
  isAnonymous: boolean
  createdAt: Timestamp
  email?: string
  displayName?: string
}
```

#### Project Document
```typescript
{
  userId: string
  name: string
  isDefault: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

#### File Document
```typescript
{
  projectId: string
  userId: string
  name: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

#### Main Item Document
```typescript
{
  name: string
  order: number
  createdAt: Timestamp
  updatedAt: Timestamp
  defaultSubItemId: string
}
```

#### Sub Item Document (Contains React Flow State)
```typescript
{
  name: string
  order: number
  createdAt: Timestamp
  updatedAt: Timestamp
  isDefault: boolean
  parentMainItemId?: string
  parentSubItemId?: string
  reactFlowState: {
    nodes: [...],
    edges: [...],
    viewport?: {...}
  }
}
```

## 4. Security Rules

The `firestore.rules` file contains security rules that ensure:
- Users can only access their own data
- Anonymous users are treated the same as authenticated users
- Nested collections inherit parent permissions
- Read/write operations are properly scoped

## 5. Authentication Flow

### Anonymous Login (Default)
- Users are automatically signed in anonymously when they first open the app
- A default project is created for them
- All their work is saved under their anonymous userId

### Upgrade to Email/Password
- Later, users can create an account with email/password
- Their anonymous account is linked to the new credentials
- All existing data (projects, files, etc.) is preserved
- The userId remains the same

## 6. Next Steps

After completing the setup above:
1. Fill in your `.env.local` with actual Firebase credentials
2. Run `npm install firebase` if not already done
3. Test the authentication flow
4. Implement Firebase helper functions for CRUD operations
5. Connect the UI to Firestore

