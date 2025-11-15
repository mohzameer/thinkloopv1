import { useState, useEffect, useCallback, useRef } from 'react'
import { getReactFlowState, updateSubItemReactFlowState } from '../firebase/database'
import type { ReactFlowState } from '../types/firebase'

interface CanvasState {
  state: ReactFlowState | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
  lastSaved: Date | null
}

interface UseCanvasOptions {
  autoSave?: boolean
  autoSaveDelay?: number // milliseconds
}

/**
 * Hook to manage React Flow canvas state with auto-save
 * Handles loading, saving, and syncing canvas state with Firestore
 */
export const useCanvas = (
  fileId: string | null,
  mainItemId: string | null,
  subItemId: string | null,
  options: UseCanvasOptions = {}
) => {
  const { autoSave = true, autoSaveDelay = 1000 } = options

  const [state, setState] = useState<CanvasState>({
    state: null,
    isLoading: true,
    isSaving: false,
    error: null,
    lastSaved: null
  })

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingSaveRef = useRef<ReactFlowState | null>(null)

  // Load canvas state
  const loadCanvas = useCallback(async () => {
    if (!fileId || !mainItemId || !subItemId) {
      setState({ state: null, isLoading: false, isSaving: false, error: null, lastSaved: null })
      return
    }

    try {
      console.log('[useCanvas] Loading canvas state:', { fileId, mainItemId, subItemId })
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const canvasState = await getReactFlowState(fileId, mainItemId, subItemId)

      if (canvasState) {
        console.log('[useCanvas] Canvas state loaded:', canvasState.nodes.length, 'nodes')
        setState({
          state: canvasState,
          isLoading: false,
          isSaving: false,
          error: null,
          lastSaved: null
        })
      } else {
        console.warn('[useCanvas] No canvas state found, using empty state')
        const emptyState: ReactFlowState = {
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 }
        }
        setState({
          state: emptyState,
          isLoading: false,
          isSaving: false,
          error: null,
          lastSaved: null
        })
      }
    } catch (error: any) {
      console.error('[useCanvas] Error loading canvas state:', error)
      setState({
        state: null,
        isLoading: false,
        isSaving: false,
        error: error.message || 'Failed to load canvas',
        lastSaved: null
      })
    }
  }, [fileId, mainItemId, subItemId])

  // Load on mount or when IDs change
  useEffect(() => {
    loadCanvas()

    // Clear any pending saves when switching canvases
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
      pendingSaveRef.current = null
    }
  }, [loadCanvas])

  // Save canvas state
  const saveCanvas = useCallback(async (canvasState: ReactFlowState): Promise<boolean> => {
    if (!fileId || !mainItemId || !subItemId) {
      console.warn('[useCanvas] Cannot save: missing IDs')
      return false
    }

    try {
      console.log('[useCanvas] Saving canvas state...')
      setState(prev => ({ ...prev, isSaving: true, error: null }))

      await updateSubItemReactFlowState(fileId, mainItemId, subItemId, canvasState)

      console.log('[useCanvas] Canvas state saved')
      setState(prev => ({
        ...prev,
        state: canvasState,
        isSaving: false,
        lastSaved: new Date()
      }))

      return true
    } catch (error: any) {
      console.error('[useCanvas] Error saving canvas state:', error)
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: error.message || 'Failed to save canvas'
      }))
      return false
    }
  }, [fileId, mainItemId, subItemId])

  // Schedule auto-save (debounced)
  const scheduleAutoSave = useCallback((canvasState: ReactFlowState) => {
    if (!autoSave) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Store pending save
    pendingSaveRef.current = canvasState

    // Schedule new save
    saveTimeoutRef.current = setTimeout(() => {
      if (pendingSaveRef.current) {
        saveCanvas(pendingSaveRef.current)
        pendingSaveRef.current = null
      }
    }, autoSaveDelay)
  }, [autoSave, autoSaveDelay, saveCanvas])

  // Update canvas state (triggers auto-save)
  const updateCanvas = useCallback((canvasState: ReactFlowState) => {
    setState(prev => ({ ...prev, state: canvasState }))
    scheduleAutoSave(canvasState)
  }, [scheduleAutoSave])

  // Force immediate save
  const forceSave = useCallback(async (): Promise<boolean> => {
    // Clear pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    // Save current state
    if (state.state) {
      return await saveCanvas(state.state)
    }

    return false
  }, [state.state, saveCanvas])

  return {
    canvasState: state.state,
    isLoading: state.isLoading,
    isSaving: state.isSaving,
    error: state.error,
    lastSaved: state.lastSaved,
    updateCanvas,
    saveCanvas,
    forceSave,
    reload: loadCanvas
  }
}

