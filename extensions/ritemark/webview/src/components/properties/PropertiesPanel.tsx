import { useState, useCallback } from 'react'
import { Button } from '../ui/button'
import { Icon } from '../ui/Icon'
import { PropertyRow } from './PropertyRow'
import { AddPropertyMenu } from './AddPropertyMenu'
import { COMMON_PROPERTIES, type PropertyType } from './types'

export interface DocumentProperties {
  [key: string]: unknown
}

interface PropertiesPanelProps {
  properties: DocumentProperties
  hasProperties: boolean
  onChange: (properties: DocumentProperties) => void
}

export function PropertiesPanel({ properties, onChange }: PropertiesPanelProps) {
  const [showAddMenu, setShowAddMenu] = useState(false)

  const handlePropertyChange = useCallback((key: string, value: unknown) => {
    onChange({ ...properties, [key]: value })
  }, [properties, onChange])

  const handlePropertyDelete = useCallback((key: string) => {
    const newProps = { ...properties }
    delete newProps[key]
    onChange(newProps)
  }, [properties, onChange])

  const handleAddProperty = useCallback((key: string, type: PropertyType) => {
    let initialValue: unknown = ''
    if (type === 'tags') initialValue = []
    else if (type === 'status') initialValue = 'draft'
    else if (type === 'date') initialValue = new Date().toISOString().split('T')[0]
    onChange({ ...properties, [key]: initialValue })
    setShowAddMenu(false)
  }, [properties, onChange])

  const getPropertyType = (key: string): PropertyType => {
    const common = COMMON_PROPERTIES.find(p => p.key === key)
    if (common) return common.type
    const value = properties[key]
    if (Array.isArray(value)) return 'tags'
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date'
    return 'text'
  }

  const getPropertyLabel = (key: string): string => {
    const common = COMMON_PROPERTIES.find(p => p.key === key)
    if (common) return common.label
    return key.charAt(0).toUpperCase() + key.slice(1)
  }

  const propertyEntries = Object.entries(properties)

  return (
    <div className="flex flex-col gap-3 p-3">
      {propertyEntries.length === 0 ? (
        <p className="text-[12px] text-ink-muted py-1">No properties yet.</p>
      ) : (
        propertyEntries.map(([key, value]) => (
          <PropertyRow
            key={key}
            propertyKey={key}
            label={getPropertyLabel(key)}
            value={value}
            type={getPropertyType(key)}
            onChange={(newValue) => handlePropertyChange(key, newValue)}
            onDelete={() => handlePropertyDelete(key)}
          />
        ))
      )}

      <div className="relative">
        <Button
          variant="toolbar"
          size="sm"
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="text-ink-body"
        >
          <Icon name="plus" size={14} tone="muted" />
          Add
        </Button>
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
