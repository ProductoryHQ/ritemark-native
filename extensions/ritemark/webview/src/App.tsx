import { useState, useEffect } from 'react'
import { onMessage, sendToExtension } from './bridge'
import { Editor } from './components/Editor'

function App() {
  const [content, setContent] = useState<string>('')
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Listen for messages from VS Code extension
    onMessage((message) => {
      if (message.type === 'load') {
        setContent(message.content)
        setIsReady(true)
      }
    })

    // Tell extension we're ready
    sendToExtension('ready', {})
  }, [])

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    sendToExtension('contentChanged', { content: newContent })
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--vscode-editor-background)]">
        <div className="text-[var(--vscode-foreground)]">Loading editor...</div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[var(--vscode-editor-background)]">
      <Editor
        value={content}
        onChange={handleContentChange}
        placeholder="Start writing..."
        className="h-full"
      />
    </div>
  )
}

export default App
