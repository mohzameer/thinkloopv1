import { useState, useEffect, useCallback } from 'react'
import { getProjectFiles, createFile, updateFileName, deleteFile, updateFileTags as updateFileTagsDb } from '../firebase/database'
import type { FileDocument, Tag } from '../types/firebase'

interface FileItem {
  id: string
  data: FileDocument
}

interface FilesState {
  files: FileItem[]
  isLoading: boolean
  error: string | null
}

/**
 * Hook to manage files in a project
 * Provides files list and CRUD operations
 */
export const useFiles = (projectId: string | null, userId: string | null) => {
  const [state, setState] = useState<FilesState>({
    files: [],
    isLoading: true,
    error: null
  })

  // Load files
  const loadFiles = useCallback(async () => {
    if (!projectId || !userId) {
      setState({ files: [], isLoading: false, error: null })
      return
    }

    try {
      console.log('[useFiles] Loading files for project:', projectId)
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const files = await getProjectFiles(projectId, userId)
      console.log('[useFiles] Loaded', files.length, 'files')
      
      setState({ files, isLoading: false, error: null })
    } catch (error: any) {
      console.error('[useFiles] Error loading files:', error)
      setState({ files: [], isLoading: false, error: error.message || 'Failed to load files' })
    }
  }, [projectId, userId])

  // Initial load
  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  // Create new file
  const createNewFile = useCallback(async (fileName: string): Promise<string | null> => {
    if (!projectId || !userId) {
      console.error('[useFiles] Cannot create file: missing projectId or userId')
      return null
    }

    try {
      console.log('[useFiles] Creating file:', fileName)
      const fileId = await createFile(projectId, userId, fileName)
      console.log('[useFiles] File created:', fileId)
      
      // Reload files to include the new one
      await loadFiles()
      
      return fileId
    } catch (error: any) {
      console.error('[useFiles] Error creating file:', error)
      setState(prev => ({ ...prev, error: error.message || 'Failed to create file' }))
      return null
    }
  }, [projectId, userId, loadFiles])

  // Rename file
  const renameFile = useCallback(async (fileId: string, newName: string): Promise<boolean> => {
    try {
      console.log('[useFiles] Renaming file:', fileId, 'to', newName)
      await updateFileName(fileId, newName)
      
      // Update local state
      setState(prev => ({
        ...prev,
        files: prev.files.map(file =>
          file.id === fileId
            ? { ...file, data: { ...file.data, name: newName } }
            : file
        )
      }))
      
      return true
    } catch (error: any) {
      console.error('[useFiles] Error renaming file:', error)
      setState(prev => ({ ...prev, error: error.message || 'Failed to rename file' }))
      return false
    }
  }, [])

  // Delete file
  const removeFile = useCallback(async (fileId: string): Promise<boolean> => {
    try {
      console.log('[useFiles] Deleting file:', fileId)
      await deleteFile(fileId)
      
      // Remove from local state
      setState(prev => ({
        ...prev,
        files: prev.files.filter(file => file.id !== fileId)
      }))
      
      return true
    } catch (error: any) {
      console.error('[useFiles] Error deleting file:', error)
      setState(prev => ({ ...prev, error: error.message || 'Failed to delete file' }))
      return false
    }
  }, [])

  // Update file tags
  const updateTags = useCallback(async (fileId: string, tags: Tag[]): Promise<boolean> => {
    try {
      console.log('[useFiles] Updating tags for file:', fileId)
      await updateFileTagsDb(fileId, tags)
      
      // Update local state immediately
      setState(prev => ({
        ...prev,
        files: prev.files.map(file =>
          file.id === fileId
            ? { ...file, data: { ...file.data, tags } }
            : file
        )
      }))
      
      return true
    } catch (error: any) {
      console.error('[useFiles] Error updating tags:', error)
      setState(prev => ({ ...prev, error: error.message || 'Failed to update tags' }))
      return false
    }
  }, [])

  // Refresh files
  const refresh = useCallback(() => {
    loadFiles()
  }, [loadFiles])

  return {
    files: state.files,
    isLoading: state.isLoading,
    error: state.error,
    createFile: createNewFile,
    renameFile,
    deleteFile: removeFile,
    updateTags,
    refresh
  }
}

