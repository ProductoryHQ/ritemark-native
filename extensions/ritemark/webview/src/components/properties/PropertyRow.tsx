import { useState, useRef, useEffect } from 'react'
import { X, Calendar } from 'lucide-react'
import type { PropertyType } from './PropertiesPanel'
import { TagsInput } from './TagsInput'
import { StatusSelect } from './StatusSelect'

interface PropertyRowProps {
  propertyKey: string
  label: string
  value: unknown
  type: PropertyType
  onChange: (value: unknown) => void
  onDelete: () => void
}

// Check if text is long enough to need multiline treatment
const isLongText = (value: unknown): boolean => {
  if (typeof value !== 'string') return false
  return value.length > 80 || value.includes('\n')
}

export function PropertyRow({ propertyKey, label, value, type, onChange, onDelete }: PropertyRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const needsMultiline = type === 'text' && isLongText(value)

  // Start editing with current value
  const startEditing = () => {
    if (type === 'text' || type === 'date') {
      setEditValue(String(value || ''))
      setIsEditing(true)
    }
  }

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing) {
      if (needsMultiline && textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.select()
        // Auto-resize textarea
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
      } else if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }
  }, [isEditing, needsMultiline])

  // Save on blur or Enter
  const handleSave = () => {
    onChange(editValue)
    setIsEditing(false)
  }

  // Cancel on Escape, save on Enter (or Cmd+Enter for textarea)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (!needsMultiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  // Auto-resize textarea on input
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }

  // Format value for display
  const formatDisplayValue = (): string => {
    if (value === null || value === undefined || value === '') {
      return '(empty)'
    }

    if (type === 'date' && typeof value === 'string') {
      // Format date nicely
      try {
        const date = new Date(value)
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      } catch {
        return String(value)
      }
    }

    if (type === 'tags' && Array.isArray(value)) {
      return value.length === 0 ? '(no tags)' : value.join(', ')
    }

    if (type === 'status') {
      return String(value).charAt(0).toUpperCase() + String(value).slice(1)
    }

    return String(value)
  }

  // Render input based on type
  const renderInput = () => {
    switch (type) {
      case 'text':
        if (isEditing) {
          // Use textarea for long text
          if (needsMultiline || (editValue && editValue.length > 80)) {
            return (
              <textarea
                ref={textareaRef}
                value={editValue}
                onChange={handleTextareaChange}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                rows={3}
                className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none overflow-hidden"
                placeholder="Enter text... (Cmd+Enter to save)"
              />
            )
          }
          return (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          )
        }
        return (
          <div
            onClick={startEditing}
            className={`w-full px-2 py-1 text-sm cursor-text hover:bg-white rounded transition-colors ${
              !value ? 'text-gray-400 italic' : 'text-gray-900'
            }`}
          >
            {formatDisplayValue()}
          </div>
        )

      case 'date':
        return (
          <div className="flex-1 flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            <input
              type="date"
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer"
            />
          </div>
        )

      case 'tags':
        return (
          <TagsInput
            tags={Array.isArray(value) ? value.map(String) : []}
            onChange={(tags) => onChange(tags)}
          />
        )

      case 'status':
        return (
          <StatusSelect
            value={String(value || 'draft')}
            onChange={(status) => onChange(status)}
          />
        )

      default:
        return (
          <span className="flex-1 px-2 py-1 text-sm text-gray-900">
            {String(value)}
          </span>
        )
    }
  }

  return (
    <div className={`flex gap-2 py-1.5 group ${needsMultiline ? 'items-start' : 'items-center'}`}>
      {/* Label */}
      <span className={`w-24 text-xs font-medium text-gray-500 uppercase tracking-wide flex-shrink-0 ${needsMultiline ? 'pt-1' : ''}`}>
        {label}
      </span>

      {/* Value / Input */}
      <div className="flex-1 min-w-0">
        {renderInput()}
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className={`p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${needsMultiline ? 'mt-1' : ''}`}
        title={`Remove ${label}`}
      >
        <X size={14} />
      </button>
    </div>
  )
}
