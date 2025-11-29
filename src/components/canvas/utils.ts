import type { Tag } from '../../types/firebase'

// Available colors for random assignment when creating new tags
export const availableColors = [
  '#fa5252', // red
  '#82c91e', // lime
  '#e64980', // pink
  '#7950f2', // violet
  '#20c997', // green
  '#ff6b6b', // coral
  '#cc5de8', // grape
  '#51cf66', // light green
  '#ff8787', // light red
  '#339af0', // light blue
  '#ff922b', // light orange
  '#69db7c', // mint
  '#fd7e14', // orange
  '#15aabf', // cyan
  '#12b886', // teal
]

// Helper function to get color for a tag from the tags list
export const getTagColor = (tagName: string, tags: Tag[]): string => {
  const tag = tags.find(t => t.name === tagName)
  return tag?.color || '#868e96' // default gray if not found
}

