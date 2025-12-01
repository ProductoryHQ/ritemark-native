/**
 * AI Chat Sidebar
 * Simplified version adapted from ritemark-app
 */

import { useState, useRef, useEffect } from 'react'
import { sendToExtension } from '../../bridge'
import { Send, Square, ChevronRight, Key, Sparkles } from 'lucide-react'
import type { EditorSelection } from '../../types/editor'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
}

interface AIChatSidebarProps {
  hasApiKey: boolean
  isExpanded: boolean
  onToggle: () => void
  selection: EditorSelection | null
  // AI state passed from parent
  isLoading: boolean
  streamingContent: string
  onSendMessage: (prompt: string) => void
  onCancel: () => void
  messages: Message[]
}

export function AIChatSidebar({
  hasApiKey,
  isExpanded,
  onToggle,
  selection,
  isLoading,
  streamingContent,
  onSendMessage,
  onCancel,
  messages
}: AIChatSidebarProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && hasApiKey) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isExpanded, hasApiKey])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    onSendMessage(input.trim())
    setInput('')
  }

  const handleConfigureKey = () => {
    sendToExtension('ai-configure-key')
  }

  // Collapsed state
  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className="w-10 h-full flex flex-col items-center py-3 gap-4 cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)] transition-colors border-l border-[var(--vscode-panel-border)]"
        title="Expand AI Assistant (⌘⇧A)"
      >
        <Sparkles className="w-5 h-5 text-[var(--vscode-symbolIcon-variableForeground)]" />
        {selection && !selection.isEmpty && (
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
        )}
      </button>
    )
  }

  return (
    <div className="w-80 h-full flex flex-col border-l border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)]">
      {/* Header */}
      <div className="p-3 border-b border-[var(--vscode-panel-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className="p-1 rounded hover:bg-[var(--vscode-list-hoverBackground)]"
              title="Collapse sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div>
              <h2 className="font-semibold text-sm">AI Assistant</h2>
              <p className="text-xs text-[var(--vscode-descriptionForeground)]">
                {hasApiKey ? 'Ask me to edit your document' : 'API key required'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* No API Key State */}
      {!hasApiKey && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Key className="w-12 h-12 text-[var(--vscode-descriptionForeground)] mb-4" />
          <h3 className="font-medium mb-2">OpenAI API Key Required</h3>
          <p className="text-sm text-[var(--vscode-descriptionForeground)] mb-4">
            Add your API key to enable AI features
          </p>
          <button
            onClick={handleConfigureKey}
            className="px-4 py-2 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded hover:bg-[var(--vscode-button-hoverBackground)]"
          >
            Configure API Key
          </button>
        </div>
      )}

      {/* Chat Messages */}
      {hasApiKey && (
        <>
          {/* Selection Indicator */}
          {selection && !selection.isEmpty && (
            <div className="px-3 py-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-inputValidation-infoBackground)]">
              <div className="text-xs text-[var(--vscode-inputValidation-infoForeground)]">
                <span className="font-medium">Selected: </span>
                {selection.text.length > 50
                  ? selection.text.substring(0, 50) + '...'
                  : selection.text}
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && !streamingContent && (
              <div className="text-center text-sm text-[var(--vscode-descriptionForeground)] py-8">
                <p>Ask me to help edit your document.</p>
                <p className="mt-2 text-xs">Examples:</p>
                <ul className="mt-1 text-xs space-y-1">
                  <li>"Make this paragraph shorter"</li>
                  <li>"Replace all 'user' with 'customer'"</li>
                  <li>"Add a conclusion"</li>
                </ul>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`text-sm ${
                  msg.role === 'user'
                    ? 'bg-[var(--vscode-input-background)] rounded-lg p-2'
                    : ''
                }`}
              >
                {msg.content}
              </div>
            ))}

            {/* Streaming message */}
            {streamingContent && (
              <div className="text-sm">
                {streamingContent}
                <span className="animate-pulse">▊</span>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && !streamingContent && (
              <div className="text-sm text-[var(--vscode-descriptionForeground)]">
                Thinking...
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-[var(--vscode-panel-border)]">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isLoading ? 'Processing...' : 'Ask AI...'}
                disabled={isLoading}
                className="flex-1 px-3 py-2 text-sm bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded focus:outline-none focus:border-[var(--vscode-focusBorder)]"
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="p-2 bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] rounded hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                  title="Stop"
                >
                  <Square className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50"
                  title="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  )
}

export default AIChatSidebar
