# Custom Hooks - Quick Reference

## Import

```typescript
import { useAuth } from './hooks/useAuth'
import { useProject } from './hooks/useProject'
import { useFiles } from './hooks/useFiles'
import { useHierarchy } from './hooks/useHierarchy'
import { useCanvas } from './hooks/useCanvas'
```

## useAuth

```typescript
const { user, userId, isAnonymous, isLoading, isInitialized } = useAuth()
```

## useProject

```typescript
const { project, isLoading, error } = useProject(userId)
// project: { id: string, data: Project } | null
```

## useFiles

```typescript
const { 
  files,                    // Array of files
  isLoading, 
  error,
  createFile,               // (fileName) => Promise<fileId | null>
  renameFile,               // (fileId, newName) => Promise<boolean>
  deleteFile,               // (fileId) => Promise<boolean>
  refresh                   // () => void
} = useFiles(projectId, userId)
```

## useHierarchy

```typescript
const { 
  mainItems,                // Array of main items with sub-items
  isLoading, 
  error,
  createMainItem,           // (name, state?) => Promise<{mainItemId, subItemId} | null>
  renameMainItem,           // (mainItemId, newName) => Promise<boolean>
  deleteMainItem,           // (mainItemId) => Promise<boolean>
  createVariation,          // (mainItemId, name, state, parentId?) => Promise<subItemId | null>
  renameSubItem,            // (mainItemId, subItemId, newName) => Promise<boolean>
  deleteSubItem,            // (mainItemId, subItemId) => Promise<boolean>
  branchVariation,          // (mainItemId, sourceSubItemId, newName) => Promise<subItemId | null>
  promoteToMain,            // (mainItemId, subItemId, newName) => Promise<{...} | null>
  refresh                   // () => void
} = useHierarchy(fileId)
```

## useCanvas

```typescript
const { 
  canvasState,              // ReactFlowState | null
  isLoading, 
  isSaving,
  error,
  lastSaved,                // Date | null
  updateCanvas,             // (state) => void  [triggers auto-save]
  saveCanvas,               // (state) => Promise<boolean>  [manual save]
  forceSave,                // () => Promise<boolean>  [save now]
  reload                    // () => void
} = useCanvas(fileId, mainItemId, subItemId, { 
  autoSave: true,           // Optional: enable auto-save (default: true)
  autoSaveDelay: 1000       // Optional: delay in ms (default: 1000)
})
```

## Quick Start Pattern

```typescript
function App() {
  // 1. Auth
  const { userId } = useAuth()
  
  // 2. Project
  const { project } = useProject(userId)
  
  // 3. Files
  const { files } = useFiles(project?.id, userId)
  
  // 4. Select file
  const fileId = files[0]?.id
  
  // 5. Hierarchy
  const { mainItems } = useHierarchy(fileId)
  
  // 6. Select main/sub
  const mainId = mainItems[0]?.id
  const subId = mainItems[0]?.data.defaultSubItemId
  
  // 7. Canvas
  const { canvasState, updateCanvas } = useCanvas(fileId, mainId, subId)
  
  // 8. Use in React Flow
  const [nodes, setNodes] = useNodesState(canvasState?.nodes || [])
  const [edges, setEdges] = useEdgesState(canvasState?.edges || [])
  
  useEffect(() => {
    updateCanvas({ nodes, edges, viewport: {...} })
  }, [nodes, edges])
}
```

## Common Operations

### Create File
```typescript
const fileId = await createFile('My Post')
```

### Branch Variation
```typescript
const newSubId = await branchVariation(mainItemId, subItemId, 'Var 2')
```

### Promote to Main
```typescript
const result = await promoteToMain(mainItemId, subItemId, 'Main-Var2')
```

### Save Canvas
```typescript
// Auto-save (recommended)
updateCanvas({ nodes, edges, viewport })

// Manual save
await saveCanvas({ nodes, edges, viewport })

// Force immediate save
await forceSave()
```

