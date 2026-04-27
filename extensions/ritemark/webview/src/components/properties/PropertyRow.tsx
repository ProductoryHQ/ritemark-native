import { useState, useRef, useEffect } from 'react'
import { Icon } from '../ui/Icon'
import type { PropertyType } from './types'
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

const inputClasses =
  'w-full rounded-md border border-hairline-strong bg-surface-muted px-2 py-1.5 text-[12px] text-ink-strong placeholder:text-ink-faint outline-none focus:ring-1 focus:ring-[--r-accent]'

export function PropertyRow({ propertyKey: _propertyKey, label, value, type, onChange, onDelete }: PropertyRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const startEditing = () => {
    if (type === 'text' || type === 'date') {
      setEditValue(String(value || ''))
      setIsEditing(true)
    }
  }

  useEffect(() => {
    if (!isEditing) return
    const el = textareaRef.current || inputRef.current
    if (el) { el.focus(); el.select() }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [isEditing])

  const handleSave = () => {
    onChange(editValue)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || type !== 'text')) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  const renderControl = () => {
    if (type === 'tags') {
      return <TagsInput tags={Array.isArray(value) ? value.map(String) : []} onChange={(tags) => onChange(tags)} />
    }

    if (type === 'status') {
      return <StatusSelect value={String(value || 'draft')} onChange={(s) => onChange(s)} />
    }

    if (type === 'date') {
      return (
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses + ' cursor-pointer'}
        />
      )
    }

    // text type
    if (isEditing) {
      const isLong = String(editValue).length > 40 || String(editValue).includes('\n')
      if (isLong) {
        return (
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            rows={2}
            className={inputClasses + ' resize-none overflow-hidden'}
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
          className={inputClasses}
        />
      )
    }

    return (
      <div
        onClick={startEditing}
        className={`w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12px] cursor-text hover:border-hairline-strong transition-colors break-words ${
          !value ? 'text-ink-faint italic' : 'text-ink-strong'
        }`}
      >
        {value ? String(value) : '(empty)'}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 group min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.4px] text-ink-muted">
          {label}
        </span>
        <button
          onClick={onDelete}
          className="p-0.5 text-ink-faint hover:text-[var(--r-error)] opacity-0 group-hover:opacity-100 transition-opacity"
          title={`Remove ${label}`}
        >
          <Icon name="x" size={12} />
        </button>
      </div>
      <div className="min-w-0">{renderControl()}</div>
    </div>
  )
}
