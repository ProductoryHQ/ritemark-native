# Sprint 56: Mermaid Test Diagrams

Use this file in Ritemark dev mode to verify inline rendering, expand view, copy/download, and error handling. Open it via `File > Open Folder...` after `./vscode/scripts/code.sh` boots.

---

## 1. Simple flowchart (small)

Should render small and centered, no oversized whitespace.

```mermaid
flowchart LR
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    B -->|No| D[End]
```

---

## 2. Wide flowchart (many nodes)

This is the case Kaja reported. Today this gets capped at 680px and shrinks until text is unreadable. After Sprint 56 it should render at content-container width and scroll horizontally if natural width exceeds the column.

```mermaid
flowchart LR
    Ingest[Ingest API] --> Validate[Validate]
    Validate --> Enrich[Enrich]
    Enrich --> Dedup[Deduplicate]
    Dedup --> Score[Score]
    Score --> Route{Route?}
    Route -->|hot| Hot[Hot path]
    Route -->|cold| Cold[Cold path]
    Hot --> Cache[Write cache]
    Cold --> Lake[Data lake]
    Cache --> Index[Search index]
    Lake --> Warehouse[Warehouse]
    Index --> Search[Search API]
    Warehouse --> Reports[Reports]
    Search --> Frontend[Frontend]
    Reports --> Frontend
    Frontend --> User[User]
```

---

## 3. Tall sequence diagram

Verifies vertical sizing and `max-height` behavior. Should not be cropped silently.

```mermaid
sequenceDiagram
    participant U as User
    participant W as Webview
    participant E as Extension
    participant FS as Filesystem
    participant LLM as LLM Provider

    U->>W: Type prompt
    W->>E: rpc:flowRun
    E->>FS: Read context files
    FS-->>E: File contents
    E->>LLM: Send request
    LLM-->>E: Stream tokens
    E-->>W: rpc:flowToken
    W-->>U: Render token
    LLM-->>E: Done
    E-->>W: rpc:flowDone
    W-->>U: Final answer
    U->>W: Edit answer
    W->>E: rpc:saveFile
    E->>FS: Write markdown
    FS-->>E: Saved
    E-->>W: rpc:saveOk
    W-->>U: Saved indicator
```

---

## 4. Class diagram (medium width)

```mermaid
classDiagram
    class CodeBlockWithCopy {
        +node: TipTapNode
        +copied: boolean
        +showCode: boolean
        +svgContent: string
        +renderError: string
        +handleCopy()
        +handleCopyImage()
        +handleDownloadImage()
        +handleExpand()
    }
    class MermaidLib {
        +renderMermaid()
        +renderMermaidToPngDataUrl()
        +ensureSvgDimensions()
    }
    class ExpandOverlay {
        +zoom: number
        +panX: number
        +panY: number
        +onWheel()
        +onClose()
    }
    CodeBlockWithCopy --> MermaidLib
    CodeBlockWithCopy --> ExpandOverlay
```

---

## 5. Invalid Mermaid (error state)

Should still show a clear error message and not crash the editor.

```mermaid
flowchart LR
    A --[broken syntax
    --> B
    B -| no closing
```

---

## Validation Checklist

- [ ] Diagram 1: small, centered, NO huge whitespace around it
- [ ] Diagram 2: fills content column width; if natural width is wider, container scrolls horizontally — NOT shrunk to fit
- [ ] Diagram 3: full height visible (within `max-height` cap), readable
- [ ] Diagram 4: medium-width renders cleanly
- [ ] Diagram 5: shows error, editor still functional
- [ ] Toolbar: `Code/Diagram` toggle, `Copy` (source), `Copy Image`, `Download Image`, `Expand`
- [ ] Copy Image → paste into another app produces PNG
- [ ] Download Image → file downloaded as PNG
- [ ] Expand: scroll/pan works; `Cmd/Ctrl+Scroll` zooms; `Escape` closes; focus returns to block
