/**
 * DATABASE HELPER FUNCTIONS - USAGE EXAMPLES
 * 
 * This file contains examples of how to use the database functions.
 * DO NOT import this file in your app - it's for reference only.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  getDefaultProject,
  getUserProjects,
  createProject,
  getProjectFiles,
  getFile,
  createFile,
  updateFileName,
  deleteFile,
  getFileMainItems,
  getMainItem,
  createMainItemWithDefaultSubItem,
  updateMainItemName,
  deleteMainItem,
  getMainItemSubItems,
  getSubItem,
  createSubItem,
  updateSubItemName,
  updateSubItemReactFlowState,
  deleteSubItem,
  duplicateSubItemAsMainItem,
  branchSubItem,
  getReactFlowState
} from './database'

// ============================================================================
// EXAMPLE 1: Initial App Setup - Get or Create Default Project
// ============================================================================

async function example1_InitialSetup(userId: string) {
  // Get user's default project (created automatically on sign-in)
  const defaultProject = await getDefaultProject(userId)
  
  if (defaultProject) {
    console.log('Default project:', defaultProject.id, defaultProject.data.name)
    return defaultProject.id
  }
  
  return null
}

// ============================================================================
// EXAMPLE 2: Create a New File
// ============================================================================

async function example2_CreateFile(projectId: string, userId: string) {
  // Create a new file
  const fileId = await createFile(projectId, userId, 'My First Post')
  
  console.log('File created:', fileId)
  // A default main item "Main" with sub-item "Var 1" is automatically created
  
  return fileId
}

// ============================================================================
// EXAMPLE 3: Load All Files for Display in Left Sidebar
// ============================================================================

async function example3_LoadFiles(projectId: string, userId: string) {
  // Get all files for the project
  const files = await getProjectFiles(projectId, userId)
  
  console.log('Files:', files)
  // Returns: [{ id: 'fileId1', data: { name: 'My First Post', ... } }, ...]
  
  // Display in UI
  files.forEach(file => {
    console.log(`- ${file.data.name} (${file.data.updatedAt})`)
  })
  
  return files
}

// ============================================================================
// EXAMPLE 4: Load Hierarchy for Right Sidebar (Version Control)
// ============================================================================

async function example4_LoadHierarchy(fileId: string) {
  // Get all main items for the file
  const mainItems = await getFileMainItems(fileId)
  
  console.log('Main items:', mainItems.length)
  
  // For each main item, get its sub-items
  for (const mainItem of mainItems) {
    console.log(`Main: ${mainItem.data.name}`)
    
    const subItems = await getMainItemSubItems(fileId, mainItem.id)
    subItems.forEach(subItem => {
      console.log(`  - ${subItem.data.name} ${subItem.data.isDefault ? '(default)' : ''}`)
    })
  }
  
  return mainItems
}

// ============================================================================
// EXAMPLE 5: Load React Flow State for a Specific Sub-Item
// ============================================================================

async function example5_LoadCanvasState(
  fileId: string,
  mainItemId: string,
  subItemId: string
) {
  // Get the React Flow state
  const state = await getReactFlowState(fileId, mainItemId, subItemId)
  
  if (state) {
    console.log('Nodes:', state.nodes.length)
    console.log('Edges:', state.edges.length)
    console.log('Viewport:', state.viewport)
    
    // Load into React Flow
    // setNodes(state.nodes)
    // setEdges(state.edges)
    // if (state.viewport) setViewport(state.viewport)
  }
  
  return state
}

// ============================================================================
// EXAMPLE 6: Save React Flow State (Auto-save)
// ============================================================================

async function example6_SaveCanvasState(
  fileId: string,
  mainItemId: string,
  subItemId: string,
  nodes: any[],
  edges: any[],
  viewport: any
) {
  // Save the current React Flow state
  await updateSubItemReactFlowState(fileId, mainItemId, subItemId, {
    nodes,
    edges,
    viewport
  })
  
  console.log('Canvas state saved')
}

// ============================================================================
// EXAMPLE 7: Branch a Sub-Item (Create Variation)
// ============================================================================

async function example7_BranchSubItem(
  fileId: string,
  mainItemId: string,
  sourceSubItemId: string
) {
  // Create a new variation from an existing sub-item
  const newSubItemId = await branchSubItem(
    fileId,
    mainItemId,
    sourceSubItemId,
    'Var 2' // Name for the new variation
  )
  
  console.log('New variation created:', newSubItemId)
  // The new sub-item has a copy of the source's React Flow state
  
  return newSubItemId
}

// ============================================================================
// EXAMPLE 8: Duplicate Sub-Item as Main Item
// ============================================================================

async function example8_DuplicateAsMainItem(
  fileId: string,
  sourceMainItemId: string,
  sourceSubItemId: string
) {
  // Duplicate a sub-item as a new main item
  // This is useful for creating a new branch of work
  const result = await duplicateSubItemAsMainItem(
    fileId,
    sourceMainItemId,
    sourceSubItemId,
    'Main-Var2' // Name for the new main item
  )
  
  console.log('New main item created:', result.mainItemId)
  console.log('With default sub-item:', result.subItemId)
  // The new main item's default sub-item has a copy of the source's state
  
  return result
}

// ============================================================================
// EXAMPLE 9: Update File Name
// ============================================================================

async function example9_RenameFile(fileId: string) {
  await updateFileName(fileId, 'Updated Post Title')
  console.log('File renamed')
}

// ============================================================================
// EXAMPLE 10: Delete a File
// ============================================================================

async function example10_DeleteFile(fileId: string) {
  // This will delete the file and all its main items and sub-items
  await deleteFile(fileId)
  console.log('File deleted')
}

// ============================================================================
// EXAMPLE 11: Complete Workflow - User Opens a File
// ============================================================================

async function example11_OpenFile(fileId: string) {
  // 1. Get the file
  const file = await getFile(fileId)
  if (!file) {
    console.error('File not found')
    return
  }
  
  console.log('Opened file:', file.data.name)
  
  // 2. Get main items
  const mainItems = await getFileMainItems(fileId)
  if (mainItems.length === 0) {
    console.error('No main items found')
    return
  }
  
  // 3. Get the first main item's default sub-item
  const firstMainItem = mainItems[0]
  const defaultSubItemId = firstMainItem.data.defaultSubItemId
  
  // 4. Load the React Flow state
  const state = await getReactFlowState(fileId, firstMainItem.id, defaultSubItemId)
  
  if (state) {
    console.log('Loaded canvas state with', state.nodes.length, 'nodes')
    // Apply to React Flow
    // setNodes(state.nodes)
    // setEdges(state.edges)
  }
}

// ============================================================================
// EXAMPLE 12: React Component Integration
// ============================================================================

/*
import { useState, useEffect } from 'react'
import { getProjectFiles, getFileMainItems, getReactFlowState } from '../firebase/database'
import { useAuth } from '../hooks/useAuth'

function FileList() {
  const { userId } = useAuth()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function loadFiles() {
      if (!userId) return
      
      try {
        const defaultProject = await getDefaultProject(userId)
        if (defaultProject) {
          const projectFiles = await getProjectFiles(defaultProject.id, userId)
          setFiles(projectFiles)
        }
      } catch (error) {
        console.error('Failed to load files:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadFiles()
  }, [userId])
  
  if (loading) return <div>Loading files...</div>
  
  return (
    <div>
      {files.map(file => (
        <div key={file.id} onClick={() => openFile(file.id)}>
          {file.data.name}
        </div>
      ))}
    </div>
  )
}

function Canvas({ fileId, mainItemId, subItemId }) {
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  
  // Load initial state
  useEffect(() => {
    async function loadState() {
      const state = await getReactFlowState(fileId, mainItemId, subItemId)
      if (state) {
        setNodes(state.nodes)
        setEdges(state.edges)
      }
    }
    loadState()
  }, [fileId, mainItemId, subItemId])
  
  // Auto-save on changes (debounced)
  useEffect(() => {
    const timeout = setTimeout(async () => {
      await updateSubItemReactFlowState(fileId, mainItemId, subItemId, {
        nodes,
        edges,
        viewport: { x: 0, y: 0, zoom: 1 }
      })
    }, 1000) // Save 1 second after last change
    
    return () => clearTimeout(timeout)
  }, [nodes, edges, fileId, mainItemId, subItemId])
  
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={(changes) => applyNodeChanges(changes, nodes, setNodes)}
      onEdgesChange={(changes) => applyEdgeChanges(changes, edges, setEdges)}
    />
  )
}
*/

// ============================================================================
// EXAMPLE 13: Error Handling
// ============================================================================

async function example13_ErrorHandling(fileId: string) {
  try {
    const file = await getFile(fileId)
    
    if (!file) {
      // File doesn't exist
      console.error('File not found')
      return
    }
    
    // Do something with file
    
  } catch (error) {
    // Network error, permission error, etc.
    console.error('Database error:', error)
    // Show user-friendly error message
  }
}

