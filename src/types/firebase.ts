import { Timestamp } from 'firebase/firestore'

// User types
export interface User {
  isAnonymous: boolean
  createdAt: Timestamp
  email?: string
  displayName?: string
}

// Project types
export interface Project {
  userId: string
  name: string
  isDefault: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Tag type
export interface Tag {
  name: string
  color: string
}

// File types
export interface FileDocument {
  projectId: string
  userId: string
  name: string
  tags: Tag[]
  lastViewedMainItemId?: string
  lastViewedSubItemId?: string
  exportContext?: string // AI-generated context for export
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Main Item types
export interface MainItem {
  name: string
  order: number
  createdAt: Timestamp
  updatedAt: Timestamp
  defaultSubItemId: string
}

// Sub Item types
export interface SubItem {
  name: string
  order: number
  createdAt: Timestamp
  updatedAt: Timestamp
  isDefault: boolean
  parentMainItemId?: string  // If duplicated from another mainItem
  parentSubItemId?: string   // If branched from another subItem
  reactFlowState: ReactFlowState
}

// React Flow types
export interface ReactFlowState {
  nodes: ReactFlowNode[]
  edges: ReactFlowEdge[]
  viewport?: ReactFlowViewport
}

export interface ReactFlowNode {
  id: string
  type: 'rectangle' | 'circle' | 'input' | 'output'
  data: {
    label: string
    categories?: string[]  // Tags
  }
  position: {
    x: number
    y: number
  }
}

export interface ReactFlowEdge {
  id: string
  source: string
  target: string
  animated?: boolean
}

export interface ReactFlowViewport {
  x: number
  y: number
  zoom: number
}

// Firestore collection paths helper types
export interface FirestorePaths {
  users: 'users'
  projects: 'projects'
  files: 'files'
  mainItems: 'mainItems'
  subItems: 'subItems'
}

// Conversation/Message types
export interface Message {
  role: 'user' | 'assistant'
  content: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Helper type for creating new documents (without timestamps)
export type NewProject = Omit<Project, 'createdAt' | 'updatedAt'>
export type NewFile = Omit<FileDocument, 'createdAt' | 'updatedAt'>
export type NewMainItem = Omit<MainItem, 'createdAt' | 'updatedAt'>
export type NewSubItem = Omit<SubItem, 'createdAt' | 'updatedAt'>
export type NewMessage = Omit<Message, 'createdAt' | 'updatedAt'>

