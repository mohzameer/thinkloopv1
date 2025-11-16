import { useState, useEffect, useCallback } from 'react'
import {
  getFileMainItems,
  getMainItemSubItems,
  createMainItemWithDefaultSubItem,
  updateMainItemName,
  deleteMainItem,
  createSubItem,
  updateSubItemName,
  deleteSubItem,
  branchSubItem,
  duplicateSubItemAsMainItem
} from '../firebase/database'
import type { MainItem, SubItem, ReactFlowState } from '../types/firebase'

interface MainItemWithSubItems {
  id: string
  data: MainItem
  subItems: Array<{ id: string; data: SubItem }>
}

interface HierarchyState {
  mainItems: MainItemWithSubItems[]
  isLoading: boolean
  error: string | null
}

/**
 * Hook to manage the version control hierarchy (main items and sub-items)
 * Used for the right sidebar
 */
export const useHierarchy = (fileId: string | null) => {
  const [state, setState] = useState<HierarchyState>({
    mainItems: [],
    isLoading: true,
    error: null
  })

  // Load hierarchy
  const loadHierarchy = useCallback(async () => {
    if (!fileId) {
      setState({ mainItems: [], isLoading: false, error: null })
      return
    }

    try {
      console.log('[useHierarchy] Loading hierarchy for file:', fileId)
      // Clear old items immediately when loading new file
      setState({ mainItems: [], isLoading: true, error: null })
      console.log('[useHierarchy] Cleared old mainItems, isLoading=true')

      // Get all main items
      const mainItems = await getFileMainItems(fileId)
      console.log('[useHierarchy] Loaded', mainItems.length, 'main items')

      // Get sub-items for each main item
      const mainItemsWithSubItems = await Promise.all(
        mainItems.map(async (mainItem) => {
          const subItems = await getMainItemSubItems(fileId, mainItem.id)
          return {
            ...mainItem,
            subItems
          }
        })
      )

      console.log('[useHierarchy] Setting', mainItemsWithSubItems.length, 'mainItems with subItems, isLoading=false')
      setState({ mainItems: mainItemsWithSubItems, isLoading: false, error: null })
    } catch (error: any) {
      console.error('[useHierarchy] Error loading hierarchy:', error)
      setState({ mainItems: [], isLoading: false, error: error.message || 'Failed to load hierarchy' })
    }
  }, [fileId])

  // Initial load
  useEffect(() => {
    loadHierarchy()
  }, [loadHierarchy])

  // Create main item
  const createMainItem = useCallback(async (
    name: string,
    initialState?: ReactFlowState
  ): Promise<{ mainItemId: string; subItemId: string } | null> => {
    if (!fileId) return null

    try {
      console.log('[useHierarchy] Creating main item:', name)
      const result = await createMainItemWithDefaultSubItem(fileId, name, initialState)
      await loadHierarchy()
      return result
    } catch (error: any) {
      console.error('[useHierarchy] Error creating main item:', error)
      setState(prev => ({ ...prev, error: error.message || 'Failed to create main item' }))
      return null
    }
  }, [fileId, loadHierarchy])

  // Rename main item
  const renameMainItem = useCallback(async (mainItemId: string, newName: string): Promise<boolean> => {
    if (!fileId) return false

    try {
      console.log('[useHierarchy] Renaming main item:', mainItemId)
      await updateMainItemName(fileId, mainItemId, newName)
      
      // Update local state
      setState(prev => ({
        ...prev,
        mainItems: prev.mainItems.map(item =>
          item.id === mainItemId
            ? { ...item, data: { ...item.data, name: newName } }
            : item
        )
      }))
      
      return true
    } catch (error: any) {
      console.error('[useHierarchy] Error renaming main item:', error)
      setState(prev => ({ ...prev, error: error.message || 'Failed to rename main item' }))
      return false
    }
  }, [fileId])

  // Delete main item
  const removeMainItem = useCallback(async (mainItemId: string): Promise<boolean> => {
    if (!fileId) return false

    try {
      console.log('[useHierarchy] Deleting main item:', mainItemId)
      await deleteMainItem(fileId, mainItemId)
      
      // Remove from local state
      setState(prev => ({
        ...prev,
        mainItems: prev.mainItems.filter(item => item.id !== mainItemId)
      }))
      
      return true
    } catch (error: any) {
      console.error('[useHierarchy] Error deleting main item:', error)
      setState(prev => ({ ...prev, error: error.message || 'Failed to delete main item' }))
      return false
    }
  }, [fileId])

  // Create sub-item (variation)
  const createVariation = useCallback(async (
    mainItemId: string,
    name: string,
    reactFlowState: ReactFlowState,
    parentSubItemId?: string
  ): Promise<string | null> => {
    if (!fileId) return null

    try {
      console.log('[useHierarchy] Creating variation:', name)
      const subItemId = await createSubItem(fileId, mainItemId, name, reactFlowState, parentSubItemId)
      await loadHierarchy()
      return subItemId
    } catch (error: any) {
      console.error('[useHierarchy] Error creating variation:', error)
      setState(prev => ({ ...prev, error: error.message || 'Failed to create variation' }))
      return null
    }
  }, [fileId, loadHierarchy])

  // Rename sub-item
  const renameSubItem = useCallback(async (
    mainItemId: string,
    subItemId: string,
    newName: string
  ): Promise<boolean> => {
    if (!fileId) return false

    try {
      console.log('[useHierarchy] Renaming sub-item:', subItemId)
      await updateSubItemName(fileId, mainItemId, subItemId, newName)
      
      // Update local state
      setState(prev => ({
        ...prev,
        mainItems: prev.mainItems.map(mainItem =>
          mainItem.id === mainItemId
            ? {
                ...mainItem,
                subItems: mainItem.subItems.map(subItem =>
                  subItem.id === subItemId
                    ? { ...subItem, data: { ...subItem.data, name: newName } }
                    : subItem
                )
              }
            : mainItem
        )
      }))
      
      return true
    } catch (error: any) {
      console.error('[useHierarchy] Error renaming sub-item:', error)
      setState(prev => ({ ...prev, error: error.message || 'Failed to rename sub-item' }))
      return false
    }
  }, [fileId])

  // Delete sub-item
  const removeSubItem = useCallback(async (mainItemId: string, subItemId: string): Promise<boolean> => {
    if (!fileId) return false

    try {
      console.log('[useHierarchy] Deleting sub-item:', subItemId)
      await deleteSubItem(fileId, mainItemId, subItemId)
      
      // Remove from local state
      setState(prev => ({
        ...prev,
        mainItems: prev.mainItems.map(mainItem =>
          mainItem.id === mainItemId
            ? {
                ...mainItem,
                subItems: mainItem.subItems.filter(subItem => subItem.id !== subItemId)
              }
            : mainItem
        )
      }))
      
      return true
    } catch (error: any) {
      console.error('[useHierarchy] Error deleting sub-item:', error)
      setState(prev => ({ ...prev, error: error.message || 'Failed to delete sub-item' }))
      return false
    }
  }, [fileId])

  // Branch sub-item (create variation from existing)
  const branchVariation = useCallback(async (
    mainItemId: string,
    sourceSubItemId: string,
    newName: string
  ): Promise<string | null> => {
    if (!fileId) return null

    try {
      console.log('[useHierarchy] Branching sub-item:', sourceSubItemId)
      const newSubItemId = await branchSubItem(fileId, mainItemId, sourceSubItemId, newName)
      await loadHierarchy()
      return newSubItemId
    } catch (error: any) {
      console.error('[useHierarchy] Error branching sub-item:', error)
      setState(prev => ({ ...prev, error: error.message || 'Failed to branch variation' }))
      return null
    }
  }, [fileId, loadHierarchy])

  // Duplicate sub-item as main item
  const promoteToMain = useCallback(async (
    sourceMainItemId: string,
    sourceSubItemId: string,
    newMainItemName: string
  ): Promise<{ mainItemId: string; subItemId: string } | null> => {
    if (!fileId) return null

    try {
      console.log('[useHierarchy] Promoting sub-item to main:', sourceSubItemId)
      const result = await duplicateSubItemAsMainItem(fileId, sourceMainItemId, sourceSubItemId, newMainItemName)
      await loadHierarchy()
      return result
    } catch (error: any) {
      console.error('[useHierarchy] Error promoting to main:', error)
      setState(prev => ({ ...prev, error: error.message || 'Failed to promote to main' }))
      return null
    }
  }, [fileId, loadHierarchy])

  // Refresh hierarchy
  const refresh = useCallback(() => {
    loadHierarchy()
  }, [loadHierarchy])

  return {
    mainItems: state.mainItems,
    isLoading: state.isLoading,
    error: state.error,
    createMainItem,
    renameMainItem,
    deleteMainItem: removeMainItem,
    createVariation,
    renameSubItem,
    deleteSubItem: removeSubItem,
    branchVariation,
    promoteToMain,
    refresh
  }
}

