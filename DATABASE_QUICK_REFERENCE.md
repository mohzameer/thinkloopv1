# Database Functions - Quick Reference

## Projects
```typescript
getDefaultProject(userId)                                    // Get user's default project
getUserProjects(userId)                                      // Get all user's projects
createProject(userId, { name, isDefault })                   // Create new project
```

## Files
```typescript
getProjectFiles(projectId, userId)                           // List all files (for sidebar)
getFile(fileId)                                             // Get single file
createFile(projectId, userId, fileName)                      // Create new file
updateFileName(fileId, newName)                             // Rename file
deleteFile(fileId)                                          // Delete file + all contents
```

## Main Items
```typescript
getFileMainItems(fileId)                                     // Get all main items (for hierarchy)
getMainItem(fileId, mainItemId)                             // Get single main item
createMainItemWithDefaultSubItem(fileId, name, state?)       // Create main + default sub
updateMainItemName(fileId, mainItemId, newName)             // Rename main item
deleteMainItem(fileId, mainItemId)                          // Delete main + all subs
```

## Sub Items
```typescript
getMainItemSubItems(fileId, mainItemId)                     // Get all variations
getSubItem(fileId, mainItemId, subItemId)                   // Get single sub-item
createSubItem(fileId, mainItemId, name, state, parent?)     // Create new variation
updateSubItemName(fileId, mainItemId, subItemId, name)      // Rename variation
updateSubItemReactFlowState(fileId, mainItemId, subItemId, state)  // 💾 SAVE CANVAS
deleteSubItem(fileId, mainItemId, subItemId)                // Delete variation
```

## Special Operations
```typescript
getReactFlowState(fileId, mainItemId, subItemId)            // 📂 LOAD CANVAS
duplicateSubItemAsMainItem(fileId, mainId, subId, name)     // 🔀 Branch as Main
branchSubItem(fileId, mainItemId, sourceSubId, name)        // 🌿 Create Variation
```

## Common Workflows

### Initial Load
```typescript
const project = await getDefaultProject(userId)
const files = await getProjectFiles(project.id, userId)
```

### Load Canvas
```typescript
const state = await getReactFlowState(fileId, mainItemId, subItemId)
setNodes(state.nodes)
setEdges(state.edges)
```

### Auto-Save Canvas
```typescript
await updateSubItemReactFlowState(fileId, mainItemId, subItemId, {
  nodes, edges, viewport
})
```

### Create Variation
```typescript
const newSubId = await branchSubItem(fileId, mainItemId, currentSubId, 'Var 2')
```

### Promote to Main
```typescript
const { mainItemId, subItemId } = await duplicateSubItemAsMainItem(
  fileId, currentMainId, currentSubId, 'Main-Var2'
)
```

## Return Types

```typescript
// Single item
{ id: string, data: Project | FileDocument | MainItem | SubItem }

// Multiple items
Array<{ id: string, data: ... }>

// IDs only
string

// Special
{ mainItemId: string, subItemId: string }  // For create operations
```

## Error Handling

```typescript
try {
  const result = await someFunction()
  if (!result) {
    // Not found
  }
} catch (error) {
  // Permission, network, etc.
}
```

