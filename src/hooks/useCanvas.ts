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

interface SaveQueueItem {
  canvasKey: string
  canvasState: ReactFlowState
  timestamp: number
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

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveQueueRef = useRef<SaveQueueItem[]>([])
  const isProcessingQueueRef = useRef(false)
  const currentCanvasKeyRef = useRef<string | null>(null)

  // Load canvas state
  const loadCanvas = useCallback(async () => {
    if (!fileId || !mainItemId || !subItemId) {
      setState({ state: null, isLoading: false, isSaving: false, error: null, lastSaved: null })
      return
    }

    const canvasKey = `${fileId}-${mainItemId}-${subItemId}`

    try {
      console.log('[useCanvas] Loading canvas state:', { fileId, mainItemId, subItemId, canvasKey })
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const canvasState = await getReactFlowState(fileId, mainItemId, subItemId)

      if (canvasState) {
        console.log('[useCanvas] Canvas state loaded for', canvasKey, ':', canvasState.nodes.length, 'nodes,', canvasState.edges.length, 'edges')
        setState({
          state: { ...canvasState, _canvasKey: canvasKey } as any, // Add canvas key for verification
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
          state: { ...emptyState, _canvasKey: canvasKey } as any,
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
    const canvasKey = `${fileId}-${mainItemId}-${subItemId}`
    currentCanvasKeyRef.current = canvasKey
    
    loadCanvas()

    // Cleanup: clear only the debounce timer when switching canvases
    // Keep the queue intact so all changes are saved
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
      // Don't clear the queue - let all saves complete
      console.log('[useCanvas] Canvas unmounting, queue preserved with', saveQueueRef.current.length, 'items')
    }
  }, [loadCanvas, fileId, mainItemId, subItemId])

  // Process save queue
  const processQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || saveQueueRef.current.length === 0) {
      return
    }

    isProcessingQueueRef.current = true
    console.log('[useCanvas] Processing save queue, items:', saveQueueRef.current.length)

    while (saveQueueRef.current.length > 0) {
      const item = saveQueueRef.current[0]
      
      // Group all saves by canvas key to find duplicates
      const allSavesForThisCanvas = saveQueueRef.current.filter(
        qItem => qItem.canvasKey === item.canvasKey
      )
      
      // If there are multiple saves for the same canvas, skip to the latest one
      if (allSavesForThisCanvas.length > 1) {
        const isLatest = allSavesForThisCanvas[allSavesForThisCanvas.length - 1] === item
        if (!isLatest) {
          console.log('[useCanvas] Skipping save, newer save exists in queue for:', item.canvasKey)
          saveQueueRef.current.shift()
          continue
        }
      }

      // Extract IDs from canvas key
      const [fId, mId, sId] = item.canvasKey.split('-')

      try {
        const isCurrent = item.canvasKey === currentCanvasKeyRef.current
        console.log('[useCanvas] Executing queued save to:', { 
          fileId: fId, 
          mainItemId: mId, 
          subItemId: sId, 
          nodeCount: item.canvasState.nodes.length,
          edgeCount: item.canvasState.edges.length,
          isCurrent
        })
        
        // Only update UI state if this is for the current canvas
        if (isCurrent) {
          setState(prev => ({ ...prev, isSaving: true, error: null }))
        }

        await updateSubItemReactFlowState(fId, mId, sId, item.canvasState)

        console.log('[useCanvas] Queued save completed successfully for:', item.canvasKey)
        
        // Only update UI state if this is for the current canvas
        if (isCurrent) {
          setState(prev => ({
            ...prev,
            state: item.canvasState,
            isSaving: false,
            lastSaved: new Date()
          }))
        }
      } catch (error: any) {
        console.error('[useCanvas] Error in queued save:', error)
        if (item.canvasKey === currentCanvasKeyRef.current) {
          setState(prev => ({
            ...prev,
            isSaving: false,
            error: error.message || 'Failed to save canvas'
          }))
        }
      }

      // Remove processed item
      saveQueueRef.current.shift()
    }

    isProcessingQueueRef.current = false
    if (currentCanvasKeyRef.current) {
      setState(prev => ({ ...prev, isSaving: false }))
    }
    console.log('[useCanvas] Queue processing complete')
  }, [])

  // Save canvas state (legacy method, now uses queue)
  const saveCanvas = useCallback(async (canvasState: ReactFlowState): Promise<boolean> => {
    if (!fileId || !mainItemId || !subItemId) {
      console.warn('[useCanvas] Cannot save: missing IDs')
      return false
    }

    const canvasKey = `${fileId}-${mainItemId}-${subItemId}`
    
    // Add to queue
    saveQueueRef.current.push({
      canvasKey,
      canvasState,
      timestamp: Date.now()
    })

    console.log('[useCanvas] Added save to queue, total items:', saveQueueRef.current.length)

    // Process queue
    processQueue()

    return true
  }, [fileId, mainItemId, subItemId, processQueue])

  // Schedule auto-save (debounced with queue)
  const scheduleAutoSave = useCallback((canvasState: ReactFlowState) => {
    if (!autoSave || !fileId || !mainItemId || !subItemId) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      console.log('[useCanvas] Clearing existing auto-save timeout')
      clearTimeout(saveTimeoutRef.current)
    }

    const canvasKey = `${fileId}-${mainItemId}-${subItemId}`

    // Schedule new save
    console.log('[useCanvas] Scheduling auto-save in', autoSaveDelay, 'ms for:', canvasKey)
    saveTimeoutRef.current = setTimeout(() => {
      console.log('[useCanvas] Auto-save timer triggered for:', canvasKey)
      
      // Remove any existing pending saves for this canvas from the queue
      // (keep only the latest state for each canvas)
      saveQueueRef.current = saveQueueRef.current.filter(
        item => item.canvasKey !== canvasKey
      )
      
      // Add the latest state to queue
      saveQueueRef.current.push({
        canvasKey,
        canvasState,
        timestamp: Date.now()
      })
      
      console.log('[useCanvas] Added to queue, total items:', saveQueueRef.current.length)

      // Process queue
      processQueue()
    }, autoSaveDelay)
  }, [autoSave, autoSaveDelay, fileId, mainItemId, subItemId, processQueue])

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
      const success = await saveCanvas(state.state)
      // Wait for queue to process
      await new Promise(resolve => setTimeout(resolve, 100))
      return success
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

