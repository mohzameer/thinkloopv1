# Custom React Hooks Documentation

Complete guide to using the custom React hooks for Firebase integration.

## Overview

These hooks provide a clean, React-friendly API for all database operations:

- **`useAuth`** - Authentication state management
- **`useProject`** - Get default project
- **`useFiles`** - File management (left sidebar)
- **`useHierarchy`** - Version control hierarchy (right sidebar)
- **`useCanvas`** - Canvas state with auto-save

## useAuth

Already implemented. See `AUTHENTICATION.md` for details.

```typescript
const { user, userId, isAnonymous, isLoading, isInitialized } = useAuth()
```

## useProject

Get the user's default project.

### Usage

```typescript
import { useProject } from '../hooks/useProject'

function App() {
  const { userId } = useAuth()
  const { project, isLoading, error } = useProject(userId)
  
  if (isLoading) return <div>Loading project...</div>
  if (error) return <div>Error: {error}</div>
  if (!project) return <div>No project found</div>
  
  return <div>Project: {project.data.name}</div>
}
```

### Returns

```typescript
{
  project: { id: string, data: Project } | null
  isLoading: boolean
  error: string | null
}
```

## useFiles

Manage files with CRUD operations.

### Usage

```typescript
import { useFiles } from '../hooks/useFiles'

function FileList() {
  const { userId } = useAuth()
  const { project } = useProject(userId)
  const { 
    files, 
    isLoading, 
    error,
    createFile, 
    renameFile, 
    deleteFile,
    refresh 
  } = useFiles(project?.id || null, userId)
  
  const handleCreateFile = async () => {
    const fileId = await createFile('Untitled')
    if (fileId) {
      console.log('File created:', fileId)
    }
  }
  
  const handleRename = async (fileId: string) => {
    const success = await renameFile(fileId, 'New Name')
    if (success) {
      console.log('File renamed')
    }
  }
  
  const handleDelete = async (fileId: string) => {
    const success = await deleteFile(fileId)
    if (success) {
      console.log('File deleted')
    }
  }
  
  if (isLoading) return <div>Loading files...</div>
  
  return (
    <div>
      <button onClick={handleCreateFile}>New File</button>
      {files.map(file => (
        <div key={file.id}>
          {file.data.name}
          <button onClick={() => handleRename(file.id)}>Rename</button>
          <button onClick={() => handleDelete(file.id)}>Delete</button>
        </div>
      ))}
    </div>
  )
}
```

### Returns

```typescript
{
  files: Array<{ id: string, data: FileDocument }>
  isLoading: boolean
  error: string | null
  createFile: (fileName: string) => Promise<string | null>
  renameFile: (fileId: string, newName: string) => Promise<boolean>
  deleteFile: (fileId: string) => Promise<boolean>
  refresh: () => void
}
```

## useHierarchy

Manage the version control hierarchy (main items and sub-items).

### Usage

```typescript
import { useHierarchy } from '../hooks/useHierarchy'

function Hierarchy() {
  const { 
    mainItems, 
    isLoading, 
    error,
    createMainItem,
    renameMainItem,
    deleteMainItem,
    createVariation,
    renameSubItem,
    deleteSubItem,
    branchVariation,
    promoteToMain,
    refresh
  } = useHierarchy(fileId)
  
  const handleBranch = async (mainItemId: string, subItemId: string) => {
    const newSubItemId = await branchVariation(mainItemId, subItemId, 'Var 2')
    if (newSubItemId) {
      console.log('Variation created:', newSubItemId)
    }
  }
  
  const handlePromote = async (mainItemId: string, subItemId: string) => {
    const result = await promoteToMain(mainItemId, subItemId, 'Main-Var2')
    if (result) {
      console.log('Promoted to main:', result.mainItemId)
    }
  }
  
  if (isLoading) return <div>Loading hierarchy...</div>
  
  return (
    <div>
      {mainItems.map(mainItem => (
        <div key={mainItem.id}>
          <h3>{mainItem.data.name}</h3>
          {mainItem.subItems.map(subItem => (
            <div key={subItem.id}>
              {subItem.data.name}
              <button onClick={() => handleBranch(mainItem.id, subItem.id)}>
                Branch
              </button>
              <button onClick={() => handlePromote(mainItem.id, subItem.id)}>
                Promote
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

### Returns

```typescript
{
  mainItems: Array<{
    id: string
    data: MainItem
    subItems: Array<{ id: string, data: SubItem }>
  }>
  isLoading: boolean
  error: string | null
  createMainItem: (name: string, initialState?: ReactFlowState) => Promise<{...} | null>
  renameMainItem: (mainItemId: string, newName: string) => Promise<boolean>
  deleteMainItem: (mainItemId: string) => Promise<boolean>
  createVariation: (mainItemId: string, name: string, state: ReactFlowState, parentId?: string) => Promise<string | null>
  renameSubItem: (mainItemId: string, subItemId: string, newName: string) => Promise<boolean>
  deleteSubItem: (mainItemId: string, subItemId: string) => Promise<boolean>
  branchVariation: (mainItemId: string, sourceSubItemId: string, newName: string) => Promise<string | null>
  promoteToMain: (mainItemId: string, subItemId: string, newName: string) => Promise<{...} | null>
  refresh: () => void
}
```

## useCanvas

Manage React Flow canvas state with auto-save.

### Basic Usage

```typescript
import { useCanvas } from '../hooks/useCanvas'

function Canvas({ fileId, mainItemId, subItemId }) {
  const { 
    canvasState, 
    isLoading, 
    isSaving,
    lastSaved,
    updateCanvas,
    forceSave 
  } = useCanvas(fileId, mainItemId, subItemId)
  
  const [nodes, setNodes] = useNodesState(canvasState?.nodes || [])
  const [edges, setEdges] = useEdgesState(canvasState?.edges || [])
  
  // Update canvas state on changes (triggers auto-save)
  useEffect(() => {
    updateCanvas({
      nodes,
      edges,
      viewport: { x: 0, y: 0, zoom: 1 }
    })
  }, [nodes, edges, updateCanvas])
  
  if (isLoading) return <div>Loading canvas...</div>
  
  return (
    <div>
      {isSaving && <div>Saving...</div>}
      {lastSaved && <div>Last saved: {lastSaved.toLocaleTimeString()}</div>}
      <button onClick={forceSave}>Save Now</button>
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => applyNodeChanges(changes, nodes, setNodes)}
        onEdgesChange={(changes) => applyEdgeChanges(changes, edges, setEdges)}
      />
    </div>
  )
}
```

### Advanced Usage with Options

```typescript
// Disable auto-save
const { canvasState, updateCanvas, saveCanvas } = useCanvas(
  fileId, 
  mainItemId, 
  subItemId,
  { autoSave: false }
)

// Custom auto-save delay (2 seconds)
const { canvasState, updateCanvas } = useCanvas(
  fileId, 
  mainItemId, 
  subItemId,
  { autoSave: true, autoSaveDelay: 2000 }
)
```

### Returns

```typescript
{
  canvasState: ReactFlowState | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
  lastSaved: Date | null
  updateCanvas: (state: ReactFlowState) => void  // Triggers auto-save
  saveCanvas: (state: ReactFlowState) => Promise<boolean>  // Manual save
  forceSave: () => Promise<boolean>  // Save immediately
  reload: () => void  // Reload from database
}
```

## Complete Example: Integrated Component

```typescript
import { useAuth } from '../hooks/useAuth'
import { useProject } from '../hooks/useProject'
import { useFiles } from '../hooks/useFiles'
import { useHierarchy } from '../hooks/useHierarchy'
import { useCanvas } from '../hooks/useCanvas'

function App() {
  const { userId, isLoading: authLoading } = useAuth()
  const { project, isLoading: projectLoading } = useProject(userId)
  const { files, createFile } = useFiles(project?.id || null, userId)
  
  // Select first file or create one
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  
  useEffect(() => {
    if (files.length > 0 && !selectedFileId) {
      setSelectedFileId(files[0].id)
    } else if (files.length === 0 && project && userId) {
      // Create first file automatically
      createFile('Untitled').then(fileId => {
        if (fileId) setSelectedFileId(fileId)
      })
    }
  }, [files, project, userId, selectedFileId])
  
  if (authLoading || projectLoading) {
    return <div>Loading...</div>
  }
  
  return (
    <div>
      <FilesSidebar 
        files={files} 
        selectedFileId={selectedFileId}
        onSelect={setSelectedFileId}
      />
      
      {selectedFileId && (
        <MainCanvas fileId={selectedFileId} />
      )}
    </div>
  )
}

function MainCanvas({ fileId }: { fileId: string }) {
  const { mainItems } = useHierarchy(fileId)
  const [currentMainId, setCurrentMainId] = useState<string | null>(null)
  const [currentSubId, setCurrentSubId] = useState<string | null>(null)
  
  // Select first main item and its default sub-item
  useEffect(() => {
    if (mainItems.length > 0) {
      const firstMain = mainItems[0]
      setCurrentMainId(firstMain.id)
      setCurrentSubId(firstMain.data.defaultSubItemId)
    }
  }, [mainItems])
  
  const { 
    canvasState, 
    isLoading, 
    isSaving,
    updateCanvas 
  } = useCanvas(fileId, currentMainId, currentSubId)
  
  const [nodes, setNodes] = useNodesState(canvasState?.nodes || [])
  const [edges, setEdges] = useEdgesState(canvasState?.edges || [])
  
  // Sync canvas changes
  useEffect(() => {
    if (canvasState) {
      updateCanvas({ nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } })
    }
  }, [nodes, edges])
  
  if (isLoading) return <div>Loading canvas...</div>
  
  return (
    <div>
      {isSaving && <div>Saving...</div>}
      <ReactFlow nodes={nodes} edges={edges} {...props} />
    </div>
  )
}
```

## Best Practices

### 1. Handle Loading States
Always check `isLoading` before accessing data:
```typescript
if (isLoading) return <LoadingSpinner />
```

### 2. Handle Errors
Display user-friendly error messages:
```typescript
if (error) return <ErrorMessage message={error} />
```

### 3. Debounce Auto-Save
The default 1-second delay works well for most cases. Adjust if needed:
```typescript
useCanvas(fileId, mainItemId, subItemId, { autoSaveDelay: 2000 })
```

### 4. Force Save on Navigation
Save before switching files/sub-items:
```typescript
const { forceSave } = useCanvas(...)

const handleSwitchFile = async () => {
  await forceSave()
  switchToNewFile()
}
```

### 5. Optimize Re-renders
Use `useCallback` and `useMemo` to prevent unnecessary re-renders when passing callbacks to child components.

## Performance Tips

1. **Lazy Load**: Only load hierarchy when the right sidebar is open
2. **Memoize**: Use `React.memo` for file/hierarchy list items
3. **Debounce**: Auto-save is already debounced, don't add extra delays
4. **Batch Updates**: React Flow changes are batched automatically

## Troubleshooting

### Files not loading
- Check that `userId` and `projectId` are not null
- Check browser console for errors
- Verify Firestore security rules are deployed

### Canvas not saving
- Check browser console for save errors
- Verify file/main/sub IDs are valid
- Check network tab for Firestore write requests

### Hierarchy not updating
- Call `refresh()` after external changes
- Check that file ID is valid
- Verify main items and sub-items exist in Firestore

