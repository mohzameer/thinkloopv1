import { useState, useEffect, useCallback } from 'react'
import { 
  getSubItemNotes, 
  createNote as createNoteInDb, 
  updateNote as updateNoteInDb, 
  deleteNote as deleteNoteInDb 
} from '../firebase/database'
import type { Timestamp } from 'firebase/firestore'

export interface Note {
  id: string
  content: string
  x: number
  y: number
  createdAt: Date
  updatedAt: Date
}

interface UseNotesReturn {
  notes: Note[]
  isLoading: boolean
  error: string | null
  addNote: (content: string, x: number, y: number) => Promise<string | null>
  updateNoteContent: (id: string, content: string) => Promise<boolean>
  deleteNote: (id: string) => Promise<boolean>
  refresh: () => Promise<void>
}

/**
 * Hook to manage notes for a specific sub-item (variation)
 */
export const useNotes = (
  fileId: string | null,
  mainItemId: string | null,
  subItemId: string | null
): UseNotesReturn => {
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Convert Firestore note to app note
  const convertNote = useCallback((firestoreNote: { id: string; data: any }): Note => {
    const data = firestoreNote.data
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
    const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date()
    
    return {
      id: firestoreNote.id,
      content: data.content || '',
      x: data.x || 0,
      y: data.y || 0,
      createdAt,
      updatedAt
    }
  }, [])

  // Load notes
  const loadNotes = useCallback(async () => {
    if (!fileId || !mainItemId || !subItemId) {
      setNotes([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      console.log('[useNotes] Loading notes for:', { fileId, mainItemId, subItemId })
      
      const firestoreNotes = await getSubItemNotes(fileId, mainItemId, subItemId)
      const convertedNotes = firestoreNotes.map(convertNote)
      
      console.log('[useNotes] Loaded', convertedNotes.length, 'notes')
      setNotes(convertedNotes)
    } catch (err: any) {
      console.error('[useNotes] Error loading notes:', err)
      setError(err.message || 'Failed to load notes')
      setNotes([])
    } finally {
      setIsLoading(false)
    }
  }, [fileId, mainItemId, subItemId, convertNote])

  // Initial load and reload on change
  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  // Add note
  const addNote = useCallback(async (content: string, x: number, y: number): Promise<string | null> => {
    if (!fileId || !mainItemId || !subItemId) {
      return null
    }

    try {
      console.log('[useNotes] Creating note:', { content, x, y })
      const noteId = await createNoteInDb(fileId, mainItemId, subItemId, content, x, y)
      
      // Reload notes to get the new one with proper timestamps
      await loadNotes()
      
      return noteId
    } catch (err: any) {
      console.error('[useNotes] Error creating note:', err)
      setError(err.message || 'Failed to create note')
      return null
    }
  }, [fileId, mainItemId, subItemId, loadNotes])

  // Update note content
  const updateNoteContent = useCallback(async (id: string, content: string): Promise<boolean> => {
    if (!fileId || !mainItemId || !subItemId) {
      return false
    }

    try {
      console.log('[useNotes] Updating note:', id)
      await updateNoteInDb(fileId, mainItemId, subItemId, id, content)
      
      // Update local state
      setNotes(prev => prev.map(note => 
        note.id === id ? { ...note, content, updatedAt: new Date() } : note
      ))
      
      return true
    } catch (err: any) {
      console.error('[useNotes] Error updating note:', err)
      setError(err.message || 'Failed to update note')
      return false
    }
  }, [fileId, mainItemId, subItemId])

  // Delete note
  const deleteNote = useCallback(async (id: string): Promise<boolean> => {
    if (!fileId || !mainItemId || !subItemId) {
      return false
    }

    try {
      console.log('[useNotes] Deleting note:', id)
      await deleteNoteInDb(fileId, mainItemId, subItemId, id)
      
      // Update local state
      setNotes(prev => prev.filter(note => note.id !== id))
      
      return true
    } catch (err: any) {
      console.error('[useNotes] Error deleting note:', err)
      setError(err.message || 'Failed to delete note')
      return false
    }
  }, [fileId, mainItemId, subItemId])

  return {
    notes,
    isLoading,
    error,
    addNote,
    updateNoteContent,
    deleteNote,
    refresh: loadNotes
  }
}

