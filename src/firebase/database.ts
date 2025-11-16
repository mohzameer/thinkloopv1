import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { db } from './config'
import type {
  Project,
  FileDocument,
  MainItem,
  SubItem,
  ReactFlowState,
  NewProject,
  NewFile,
  NewMainItem,
  NewSubItem,
  Tag
} from '../types/firebase'

// ============================================================================
// PROJECT OPERATIONS
// ============================================================================

/**
 * Get the default project for a user
 */
export const getDefaultProject = async (userId: string): Promise<{ id: string; data: Project } | null> => {
  try {
    console.log('[Database] Querying for default project, userId:', userId)
    const projectsRef = collection(db, 'projects')
    const q = query(
      projectsRef,
      where('userId', '==', userId),
      where('isDefault', '==', true)
    )
    
    console.log('[Database] Executing query...')
    const snapshot = await getDocs(q)
    console.log('[Database] Query completed, found', snapshot.docs.length, 'projects')

    if (snapshot.empty) {
      console.log('[Database] No default project found for user:', userId)
      return null
    }

    const projectDoc = snapshot.docs[0]
    console.log('[Database] Default project found:', projectDoc.id)
    return {
      id: projectDoc.id,
      data: projectDoc.data() as Project
    }
  } catch (error) {
    console.error('[Database] Error getting default project:', error)
    console.error('[Database] Error details:', error)
    throw error
  }
}

/**
 * Get all projects for a user
 */
export const getUserProjects = async (userId: string): Promise<Array<{ id: string; data: Project }>> => {
  try {
    const projectsRef = collection(db, 'projects')
    const q = query(projectsRef, where('userId', '==', userId))
    const snapshot = await getDocs(q)

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() as Project
    }))
  } catch (error) {
    console.error('[Database] Error getting user projects:', error)
    throw error
  }
}

/**
 * Create a new project
 */
export const createProject = async (userId: string, projectData: Partial<NewProject>): Promise<string> => {
  try {
    const projectRef = doc(collection(db, 'projects'))
    
    await setDoc(projectRef, {
      userId,
      name: projectData.name || 'Untitled Project',
      isDefault: projectData.isDefault || false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    console.log('[Database] Project created:', projectRef.id)
    return projectRef.id
  } catch (error) {
    console.error('[Database] Error creating project:', error)
    throw error
  }
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Get all files for a project
 */
export const getProjectFiles = async (projectId: string, userId: string): Promise<Array<{ id: string; data: FileDocument }>> => {
  try {
    const filesRef = collection(db, 'files')
    const q = query(
      filesRef,
      where('projectId', '==', projectId),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() as FileDocument
    }))
  } catch (error) {
    console.error('[Database] Error getting project files:', error)
    throw error
  }
}

/**
 * Get a single file by ID
 */
export const getFile = async (fileId: string): Promise<{ id: string; data: FileDocument } | null> => {
  try {
    const fileRef = doc(db, 'files', fileId)
    const fileSnap = await getDoc(fileRef)

    if (!fileSnap.exists()) {
      return null
    }

    return {
      id: fileSnap.id,
      data: fileSnap.data() as FileDocument
    }
  } catch (error) {
    console.error('[Database] Error getting file:', error)
    throw error
  }
}

/**
 * Create a new file with default tags
 */
export const createFile = async (
  projectId: string,
  userId: string,
  fileName: string
): Promise<string> => {
  try {
    const fileRef = doc(collection(db, 'files'))
    
    // Default tags with fixed colors
    const defaultTags: Tag[] = [
      { name: 'Idea', color: '#fab005' },      // yellow
      { name: 'New', color: '#228be6' },       // blue
      { name: 'Thinking', color: '#be4bdb' },  // purple
    ]
    
    await setDoc(fileRef, {
      projectId,
      userId,
      name: fileName || 'Untitled',
      tags: defaultTags,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    console.log('[Database] File created:', fileRef.id)

    // Create default main item with default sub-item
    await createMainItemWithDefaultSubItem(fileRef.id, 'Main')

    return fileRef.id
  } catch (error) {
    console.error('[Database] Error creating file:', error)
    throw error
  }
}

/**
 * Update a file's name
 */
export const updateFileName = async (fileId: string, newName: string): Promise<void> => {
  try {
    const fileRef = doc(db, 'files', fileId)
    await updateDoc(fileRef, {
      name: newName,
      updatedAt: serverTimestamp()
    })
    console.log('[Database] File name updated:', fileId)
  } catch (error) {
    console.error('[Database] Error updating file name:', error)
    throw error
  }
}

/**
 * Update a file's tags
 */
export const updateFileTags = async (fileId: string, tags: Tag[]): Promise<void> => {
  try {
    const fileRef = doc(db, 'files', fileId)
    await updateDoc(fileRef, {
      tags,
      updatedAt: serverTimestamp()
    })
    console.log('[Database] File tags updated:', fileId)
  } catch (error) {
    console.error('[Database] Error updating file tags:', error)
    throw error
  }
}

/**
 * Delete a file and all its main items and sub-items
 */
export const deleteFile = async (fileId: string): Promise<void> => {
  try {
    // Delete all main items and their sub-items
    const mainItems = await getFileMainItems(fileId)
    for (const mainItem of mainItems) {
      await deleteMainItem(fileId, mainItem.id)
    }

    // Delete the file
    const fileRef = doc(db, 'files', fileId)
    await deleteDoc(fileRef)
    
    console.log('[Database] File deleted:', fileId)
  } catch (error) {
    console.error('[Database] Error deleting file:', error)
    throw error
  }
}

// ============================================================================
// MAIN ITEM OPERATIONS
// ============================================================================

/**
 * Get all main items for a file
 */
export const getFileMainItems = async (fileId: string): Promise<Array<{ id: string; data: MainItem }>> => {
  try {
    const mainItemsRef = collection(db, 'files', fileId, 'mainItems')
    const q = query(mainItemsRef, orderBy('order', 'asc'))
    const snapshot = await getDocs(q)

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() as MainItem
    }))
  } catch (error) {
    console.error('[Database] Error getting main items:', error)
    throw error
  }
}

/**
 * Get a single main item
 */
export const getMainItem = async (fileId: string, mainItemId: string): Promise<{ id: string; data: MainItem } | null> => {
  try {
    const mainItemRef = doc(db, 'files', fileId, 'mainItems', mainItemId)
    const mainItemSnap = await getDoc(mainItemRef)

    if (!mainItemSnap.exists()) {
      return null
    }

    return {
      id: mainItemSnap.id,
      data: mainItemSnap.data() as MainItem
    }
  } catch (error) {
    console.error('[Database] Error getting main item:', error)
    throw error
  }
}

/**
 * Create a main item with a default sub-item
 */
export const createMainItemWithDefaultSubItem = async (
  fileId: string,
  mainItemName: string,
  initialReactFlowState?: ReactFlowState
): Promise<{ mainItemId: string; subItemId: string }> => {
  try {
    const mainItemRef = doc(collection(db, 'files', fileId, 'mainItems'))
    const subItemRef = doc(collection(mainItemRef, 'subItems'))

    // Get current count of main items for ordering
    const existingMainItems = await getFileMainItems(fileId)
    const order = existingMainItems.length

    // Create main item
    await setDoc(mainItemRef, {
      name: mainItemName,
      order,
      defaultSubItemId: subItemRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    // Create default sub-item
    const defaultState: ReactFlowState = initialReactFlowState || {
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }

    await setDoc(subItemRef, {
      name: 'v1',
      order: 0,
      isDefault: true,
      reactFlowState: defaultState,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    console.log('[Database] Main item with default sub-item created:', mainItemRef.id)

    return {
      mainItemId: mainItemRef.id,
      subItemId: subItemRef.id
    }
  } catch (error) {
    console.error('[Database] Error creating main item:', error)
    throw error
  }
}

/**
 * Update main item name
 */
export const updateMainItemName = async (fileId: string, mainItemId: string, newName: string): Promise<void> => {
  try {
    const mainItemRef = doc(db, 'files', fileId, 'mainItems', mainItemId)
    await updateDoc(mainItemRef, {
      name: newName,
      updatedAt: serverTimestamp()
    })
    console.log('[Database] Main item name updated:', mainItemId)
  } catch (error) {
    console.error('[Database] Error updating main item name:', error)
    throw error
  }
}

/**
 * Delete a main item and all its sub-items
 */
export const deleteMainItem = async (fileId: string, mainItemId: string): Promise<void> => {
  try {
    // Delete all sub-items
    const subItems = await getMainItemSubItems(fileId, mainItemId)
    for (const subItem of subItems) {
      await deleteSubItem(fileId, mainItemId, subItem.id)
    }

    // Delete the main item
    const mainItemRef = doc(db, 'files', fileId, 'mainItems', mainItemId)
    await deleteDoc(mainItemRef)
    
    console.log('[Database] Main item deleted:', mainItemId)
  } catch (error) {
    console.error('[Database] Error deleting main item:', error)
    throw error
  }
}

// ============================================================================
// SUB ITEM OPERATIONS
// ============================================================================

/**
 * Get all sub-items for a main item
 */
export const getMainItemSubItems = async (
  fileId: string,
  mainItemId: string
): Promise<Array<{ id: string; data: SubItem }>> => {
  try {
    const subItemsRef = collection(db, 'files', fileId, 'mainItems', mainItemId, 'subItems')
    const q = query(subItemsRef, orderBy('order', 'asc'))
    const snapshot = await getDocs(q)

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() as SubItem
    }))
  } catch (error) {
    console.error('[Database] Error getting sub-items:', error)
    throw error
  }
}

/**
 * Get a single sub-item
 */
export const getSubItem = async (
  fileId: string,
  mainItemId: string,
  subItemId: string
): Promise<{ id: string; data: SubItem } | null> => {
  try {
    const subItemRef = doc(db, 'files', fileId, 'mainItems', mainItemId, 'subItems', subItemId)
    const subItemSnap = await getDoc(subItemRef)

    if (!subItemSnap.exists()) {
      return null
    }

    return {
      id: subItemSnap.id,
      data: subItemSnap.data() as SubItem
    }
  } catch (error) {
    console.error('[Database] Error getting sub-item:', error)
    throw error
  }
}

/**
 * Create a new sub-item (branch/variation)
 */
export const createSubItem = async (
  fileId: string,
  mainItemId: string,
  subItemName: string,
  reactFlowState: ReactFlowState,
  parentSubItemId?: string
): Promise<string> => {
  try {
    const subItemRef = doc(collection(db, 'files', fileId, 'mainItems', mainItemId, 'subItems'))

    // Get current count for ordering
    const existingSubItems = await getMainItemSubItems(fileId, mainItemId)
    const order = existingSubItems.length

    await setDoc(subItemRef, {
      name: subItemName,
      order,
      isDefault: false,
      parentSubItemId: parentSubItemId || null,
      reactFlowState,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    console.log('[Database] Sub-item created:', subItemRef.id)
    return subItemRef.id
  } catch (error) {
    console.error('[Database] Error creating sub-item:', error)
    throw error
  }
}

/**
 * Update sub-item name
 */
export const updateSubItemName = async (
  fileId: string,
  mainItemId: string,
  subItemId: string,
  newName: string
): Promise<void> => {
  try {
    const subItemRef = doc(db, 'files', fileId, 'mainItems', mainItemId, 'subItems', subItemId)
    await updateDoc(subItemRef, {
      name: newName,
      updatedAt: serverTimestamp()
    })
    console.log('[Database] Sub-item name updated:', subItemId)
  } catch (error) {
    console.error('[Database] Error updating sub-item name:', error)
    throw error
  }
}

/**
 * Update sub-item's React Flow state
 */
export const updateSubItemReactFlowState = async (
  fileId: string,
  mainItemId: string,
  subItemId: string,
  reactFlowState: ReactFlowState
): Promise<void> => {
  try {
    const subItemRef = doc(db, 'files', fileId, 'mainItems', mainItemId, 'subItems', subItemId)
    await updateDoc(subItemRef, {
      reactFlowState,
      updatedAt: serverTimestamp()
    })
    console.log('[Database] React Flow state updated for sub-item:', subItemId)
  } catch (error) {
    console.error('[Database] Error updating React Flow state:', error)
    throw error
  }
}

/**
 * Delete a sub-item
 */
export const deleteSubItem = async (
  fileId: string,
  mainItemId: string,
  subItemId: string
): Promise<void> => {
  try {
    const subItemRef = doc(db, 'files', fileId, 'mainItems', mainItemId, 'subItems', subItemId)
    await deleteDoc(subItemRef)
    console.log('[Database] Sub-item deleted:', subItemId)
  } catch (error) {
    console.error('[Database] Error deleting sub-item:', error)
    throw error
  }
}

// ============================================================================
// SPECIAL OPERATIONS
// ============================================================================

/**
 * Duplicate a sub-item as a new main item
 * This is used for creating variations from existing work
 */
export const duplicateSubItemAsMainItem = async (
  fileId: string,
  sourceMainItemId: string,
  sourceSubItemId: string,
  newMainItemName: string
): Promise<{ mainItemId: string; subItemId: string }> => {
  try {
    // Get the source sub-item
    const sourceSubItem = await getSubItem(fileId, sourceMainItemId, sourceSubItemId)
    if (!sourceSubItem) {
      throw new Error('Source sub-item not found')
    }

    // Create new main item with the duplicated state
    const result = await createMainItemWithDefaultSubItem(
      fileId,
      newMainItemName,
      sourceSubItem.data.reactFlowState
    )

    // Update the new sub-item to track its parent
    const subItemRef = doc(db, 'files', fileId, 'mainItems', result.mainItemId, 'subItems', result.subItemId)
    await updateDoc(subItemRef, {
      parentMainItemId: sourceMainItemId,
      parentSubItemId: sourceSubItemId
    })

    console.log('[Database] Sub-item duplicated as main item:', result.mainItemId)
    return result
  } catch (error) {
    console.error('[Database] Error duplicating sub-item as main item:', error)
    throw error
  }
}

/**
 * Branch a sub-item (create a new variation within the same main item)
 */
export const branchSubItem = async (
  fileId: string,
  mainItemId: string,
  sourceSubItemId: string,
  newSubItemName: string
): Promise<string> => {
  try {
    // Get the source sub-item
    const sourceSubItem = await getSubItem(fileId, mainItemId, sourceSubItemId)
    if (!sourceSubItem) {
      throw new Error('Source sub-item not found')
    }

    // Create new sub-item with copied state
    const newSubItemId = await createSubItem(
      fileId,
      mainItemId,
      newSubItemName,
      sourceSubItem.data.reactFlowState,
      sourceSubItemId
    )

    console.log('[Database] Sub-item branched:', newSubItemId)
    return newSubItemId
  } catch (error) {
    console.error('[Database] Error branching sub-item:', error)
    throw error
  }
}

/**
 * Get the React Flow state for a specific sub-item
 */
export const getReactFlowState = async (
  fileId: string,
  mainItemId: string,
  subItemId: string
): Promise<ReactFlowState | null> => {
  try {
    const subItem = await getSubItem(fileId, mainItemId, subItemId)
    return subItem?.data.reactFlowState || null
  } catch (error) {
    console.error('[Database] Error getting React Flow state:', error)
    throw error
  }
}

