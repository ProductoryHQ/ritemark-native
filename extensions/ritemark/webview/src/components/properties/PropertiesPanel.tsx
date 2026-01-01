import { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { PropertyRow } from './PropertyRow'
import { AddPropertyMenu } from './AddPropertyMenu'

export interface DocumentProperties {
  [key: string]: unknown
}

interface PropertiesPanelProps {
  properties: DocumentProperties
  hasProperties: boolean
  onChange: (properties: DocumentProperties) => void
}

// Common property definitions with their display labels and types
export const COMMON_PROPERTIES = [
  { key: 'title', label: 'Title', type: 'text' as const },
  { key: 'author', label: 'Author', type: 'text' as const },
  { key: 'date', label: 'Date', type: 'date' as const },
  { key: 'tags', label: 'Tags', type: 'tags' as const },
  { key: 'status', label: 'Status', type: 'status' as const },
  { key: 'description', label: 'Description', type: 'text' as const },
] as const

export type PropertyType = 'text' | 'date' | 'tags' | 'status'

export function PropertiesPanel({ properties, hasProperties, onChange }: PropertiesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(hasProperties)
  const [showAddMenu, setShowAddMenu] = useState(false)

  const propertyCount = Object.keys(properties).length

  const handlePropertyChange = useCallback((key: string, value: unknown) => {
    onChange({ ...properties, [key]: value })
  }, [properties, onChange])

  const handlePropertyDelete = useCallback((key: string) => {
    const newProps = { ...properties }
    delete newProps[key]
    onChange(newProps)
  }, [properties, onChange])

  const handleAddProperty = useCallback((key: string, type: PropertyType) => {
    // Set initial value based on type
    let initialValue: unknown = ''
    if (type === 'tags') {
      initialValue = []
    } else if (type === 'status') {
      initialValue = 'draft'
    } else if (type === 'date') {
      initialValue = new Date().toISOString().split('T')[0]
    }

    onChange({ ...properties, [key]: initialValue })
    setShowAddMenu(false)

    // Expand panel when adding first property
    if (!isExpanded) {
      setIsExpanded(true)
    }
  }, [properties, onChange, isExpanded])

  // Get type for a property key
  const getPropertyType = (key: string): PropertyType => {
    const common = COMMON_PROPERTIES.find(p => p.key === key)
    if (common) return common.type

    // Infer type from value
    const value = properties[key]
    if (Array.isArray(value)) return 'tags'
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date'
    return 'text'
  }

  // Get label for a property key
  const getPropertyLabel = (key: string): string => {
    const common = COMMON_PROPERTIES.find(p => p.key === key)
    if (common) return common.label
    // Capitalize first letter for custom properties
    return key.charAt(0).toUpperCase() + key.slice(1)
  }

  // Minimal empty state - just a small button
  if (propertyCount === 0) {
    return (
      <div className="px-4 py-2 flex justify-end">
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            <Plus size={12} />
            Add properties
          </button>
          {showAddMenu && (
            <AddPropertyMenu
              existingKeys={Object.keys(properties)}
              onAdd={handleAddProperty}
              onClose={() => setShowAddMenu(false)}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-gray-200">
      {/* Header - always visible */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
          <span className="text-sm font-medium text-gray-700">
            Properties ({propertyCount})
          </span>
        </div>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            <Plus size={12} />
            Add
          </button>
          {showAddMenu && (
            <AddPropertyMenu
              existingKeys={Object.keys(properties)}
              onAdd={handleAddProperty}
              onClose={() => setShowAddMenu(false)}
            />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && propertyCount > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {Object.entries(properties).map(([key, value]) => (
            <PropertyRow
              key={key}
              propertyKey={key}
              label={getPropertyLabel(key)}
              value={value}
              type={getPropertyType(key)}
              onChange={(newValue) => handlePropertyChange(key, newValue)}
              onDelete={() => handlePropertyDelete(key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
