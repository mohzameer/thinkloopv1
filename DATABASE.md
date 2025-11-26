# Database Helper Functions Documentation

Complete guide to using the Firestore database helper functions in ThinkLoops.

## Overview

The database helpers provide a clean API for all CRUD operations on:
- **Projects** - Containers for files
- **Files** - Documents containing the canvas work
- **Main Items** - Top-level versions in the hierarchy
- **Sub Items** - Variations within a main item (contains React Flow state)

## File Structure

- `src/firebase/database.ts` - All database helper functions
- `src/firebase/database.example.ts` - Usage examples
- `src/types/firebase.ts` - TypeScript type definitions

## Quick Start

```typescript
import { getDefaultProject, createFile, getReactFlowState } from '../firebase/database'

// Get user's default project
const project = await getDefaultProject(userId)

// Create a new file
const fileId = await createFile(project.id, userId, 'My Post')

// Load canvas state
const state = await getReactFlowState(fileId, mainItemId, subItemId)
```

## Function Reference

### Projects

#### `getDefaultProject(userId: string)`
Get the user's default project (created on first sign-in).

```typescript
const project = await getDefaultProject(userId)
if (project) {
  console.log(project.id, project.data.name)
}
```

#### `getUserProjects(userId: string)`
Get all projects for a user.

```typescript
const projects = await getUserProjects(userId)
// Returns: [{ id: '...', data: { name: '...', ... } }]
```

#### `createProject(userId: string, projectData: Partial<NewProject>)`
Create a new project.

```typescript
const projectId = await createProject(userId, {
  name: 'My Project',
  isDefault: false
})
```

### Files

#### `getProjectFiles(projectId: string, userId: string)`
Get all files in a project, ordered by most recently updated.

```typescript
const files = await getProjectFiles(projectId, userId)
// Perfect for displaying in the left sidebar
```

#### `getFile(fileId: string)`
Get a single file by ID.

```typescript
const file = await getFile(fileId)
if (file) {
  console.log(file.data.name)
}
```

#### `createFile(projectId: string, userId: string, fileName: string)`
Create a new file with a default main item and sub-item.

```typescript
const fileId = await createFile(projectId, userId, 'Untitled')
// Automatically creates: Main -> Var 1
```

#### `updateFileName(fileId: string, newName: string)`
Rename a file.

```typescript
await updateFileName(fileId, 'New Title')
```

#### `deleteFile(fileId: string)`
Delete a file and all its contents.

```typescript
await deleteFile(fileId)
// Cascades: deletes all main items and sub-items
```

### Main Items

#### `getFileMainItems(fileId: string)`
Get all main items for a file, ordered by creation order.

```typescript
const mainItems = await getFileMainItems(fileId)
// Used for right sidebar hierarchy display
```

#### `getMainItem(fileId: string, mainItemId: string)`
Get a single main item.

```typescript
const mainItem = await getMainItem(fileId, mainItemId)
```

#### `createMainItemWithDefaultSubItem(fileId: string, mainItemName: string, initialReactFlowState?: ReactFlowState)`
Create a main item with its default sub-item.

```typescript
const { mainItemId, subItemId } = await createMainItemWithDefaultSubItem(
  fileId,
  'Main 2',
  { nodes: [], edges: [] } // Optional initial state
)
```

#### `updateMainItemName(fileId: string, mainItemId: string, newName: string)`
Rename a main item.

```typescript
await updateMainItemName(fileId, mainItemId, 'Updated Name')
```

#### `deleteMainItem(fileId: string, mainItemId: string)`
Delete a main item and all its sub-items.

```typescript
await deleteMainItem(fileId, mainItemId)
```

### Sub Items

#### `getMainItemSubItems(fileId: string, mainItemId: string)`
Get all sub-items (variations) for a main item.

```typescript
const subItems = await getMainItemSubItems(fileId, mainItemId)
// Used for displaying variations in hierarchy
```

#### `getSubItem(fileId: string, mainItemId: string, subItemId: string)`
Get a single sub-item.

```typescript
const subItem = await getSubItem(fileId, mainItemId, subItemId)
if (subItem) {
  console.log(subItem.data.reactFlowState)
}
```

#### `createSubItem(fileId: string, mainItemId: string, subItemName: string, reactFlowState: ReactFlowState, parentSubItemId?: string)`
Create a new sub-item (variation).

```typescript
const subItemId = await createSubItem(
  fileId,
  mainItemId,
  'Var 2',
  { nodes: [...], edges: [...] },
  sourceSubItemId // Optional parent tracking
)
```

#### `updateSubItemName(fileId: string, mainItemId: string, subItemId: string, newName: string)`
Rename a sub-item.

```typescript
await updateSubItemName(fileId, mainItemId, subItemId, 'Option A')
```

#### `updateSubItemReactFlowState(fileId: string, mainItemId: string, subItemId: string, reactFlowState: ReactFlowState)`
Save the React Flow canvas state. **Use this for auto-save!**

```typescript
await updateSubItemReactFlowState(fileId, mainItemId, subItemId, {
  nodes: currentNodes,
  edges: currentEdges,
  viewport: currentViewport
})
```

#### `deleteSubItem(fileId: string, mainItemId: string, subItemId: string)`
Delete a sub-item.

```typescript
await deleteSubItem(fileId, mainItemId, subItemId)
```

### Special Operations

#### `duplicateSubItemAsMainItem(fileId: string, sourceMainItemId: string, sourceSubItemId: string, newMainItemName: string)`
Duplicate a sub-item as a new main item. **This is the "branch as main" feature.**

```typescript
const { mainItemId, subItemId } = await duplicateSubItemAsMainItem(
  fileId,
  'main-1',
  'var-2',
  'Main-Var2'
)
// Creates new main item with copied canvas state
```

#### `branchSubItem(fileId: string, mainItemId: string, sourceSubItemId: string, newSubItemName: string)`
Branch a sub-item within the same main item. **This is the "create variation" feature.**

```typescript
const newSubItemId = await branchSubItem(
  fileId,
  mainItemId,
  sourceSubItemId,
  'Var 3'
)
// Creates new variation with copied canvas state
```

#### `getReactFlowState(fileId: string, mainItemId: string, subItemId: string)`
Get just the React Flow state (convenience function).

```typescript
const state = await getReactFlowState(fileId, mainItemId, subItemId)
if (state) {
  setNodes(state.nodes)
  setEdges(state.edges)
  setViewport(state.viewport)
}
```

## Common Patterns

### Initial App Load
```typescript
// 1. Get default project
const project = await getDefaultProject(userId)

// 2. Load files for sidebar
const files = await getProjectFiles(project.id, userId)

// 3. Open first file (or create one if none exist)
if (files.length === 0) {
  const fileId = await createFile(project.id, userId, 'Untitled')
  // Load this file
} else {
  // Load files[0]
}
```

### Loading a File
```typescript
// 1. Get main items
const mainItems = await getFileMainItems(fileId)

// 2. Load first main item's default sub-item
const defaultSubItemId = mainItems[0].data.defaultSubItemId
const state = await getReactFlowState(fileId, mainItems[0].id, defaultSubItemId)

// 3. Apply to React Flow
setNodes(state.nodes)
setEdges(state.edges)
```

### Auto-Save Canvas
```typescript
// Debounced auto-save
useEffect(() => {
  const timeout = setTimeout(async () => {
    await updateSubItemReactFlowState(fileId, mainItemId, subItemId, {
      nodes,
      edges,
      viewport
    })
  }, 1000) // Save 1 second after last change
  
  return () => clearTimeout(timeout)
}, [nodes, edges, viewport])
```

### Creating a Variation
```typescript
// User clicks "Branch" button on a sub-item
const newSubItemId = await branchSubItem(
  fileId,
  mainItemId,
  currentSubItemId,
  'Var 2'
)

// Switch to the new variation
loadSubItem(fileId, mainItemId, newSubItemId)
```

### Promoting Variation to Main
```typescript
// User clicks "Duplicate as Main" on a sub-item
const { mainItemId, subItemId } = await duplicateSubItemAsMainItem(
  fileId,
  currentMainItemId,
  currentSubItemId,
  'Main-Var2'
)

// Switch to the new main item
loadSubItem(fileId, mainItemId, subItemId)
```

## Error Handling

All functions throw errors that should be caught:

```typescript
try {
  const file = await getFile(fileId)
  if (!file) {
    // File doesn't exist
    showError('File not found')
    return
  }
  // Use file...
} catch (error) {
  // Network error, permission error, etc.
  console.error('Database error:', error)
  showError('Failed to load file')
}
```

## TypeScript Types

All return types are fully typed. Import types from:

```typescript
import type { 
  Project, 
  FileDocument, 
  MainItem, 
  SubItem, 
  ReactFlowState 
} from '../types/firebase'
```

## Performance Considerations

1. **Batch Reads**: When loading hierarchy, the functions automatically optimize queries
2. **Auto-Save**: Use debouncing (1-2 seconds) to avoid excessive writes
3. **Ordering**: Files and items are pre-ordered by the queries
4. **Caching**: Consider caching frequently accessed data in React state

## Security

All operations are protected by Firestore security rules:
- Users can only access their own data
- Files must belong to user's project
- Main items must belong to user's file
- Sub-items must belong to user's file

## Next Steps

See `database.example.ts` for more detailed usage examples including:
- React component integration
- Complete workflows
- Error handling patterns
- Real-world use cases

