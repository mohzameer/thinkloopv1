import { useState, useEffect } from 'react'
import { getDefaultProject } from '../firebase/database'
import type { Project } from '../types/firebase'

interface ProjectState {
  project: { id: string; data: Project } | null
  isLoading: boolean
  error: string | null
}

/**
 * Hook to get the user's default project
 */
export const useProject = (userId: string | null) => {
  const [state, setState] = useState<ProjectState>({
    project: null,
    isLoading: true,
    error: null
  })

  useEffect(() => {
    if (!userId) {
      setState({ project: null, isLoading: false, error: null })
      return
    }

    let mounted = true

    const loadProject = async () => {
      try {
        console.log('[useProject] Loading default project for user:', userId)
        
        // Add timeout to detect hanging queries
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout - likely a permissions issue')), 5000)
        })
        
        let project = await Promise.race([
          getDefaultProject(userId),
          timeoutPromise
        ]) as { id: string; data: any } | null
        
        // If no default project exists, create one
        if (!project && mounted) {
          console.log('[useProject] No default project found, creating one...')
          const { createDefaultProject } = await import('../firebase/auth')
          const projectId = await createDefaultProject(userId)
          
          // Load the newly created project
          project = await getDefaultProject(userId)
          console.log('[useProject] Default project created and loaded:', projectId)
        }
        
        if (mounted) {
          if (project) {
            console.log('[useProject] Project loaded:', project.id)
            setState({ project, isLoading: false, error: null })
          } else {
            console.warn('[useProject] Failed to load or create project')
            setState({ project: null, isLoading: false, error: 'Failed to load or create project' })
          }
        }
      } catch (error: any) {
        console.error('[useProject] Error loading project:', error)
        if (mounted) {
          setState({ project: null, isLoading: false, error: error.message || 'Failed to load project' })
        }
      }
    }

    loadProject()

    return () => {
      mounted = false
    }
  }, [userId])

  return state
}

