# Mermaid Smoke Test

Open this file in Ritemark after `Developer: Reload Window`.

## Expected Checks

-   The first mermaid block should render as a diagram by default.
    
-   The `Code` button should switch to raw source and back to the diagram.
    
-   The `Copy` button should copy the mermaid source, not SVG.
    
-   The invalid mermaid block should show an error state and still allow source editing.
    
-   Saving and reopening should preserve the fenced `mermaid` blocks unchanged.
    

## Valid Diagram

```mermaid
flowchart TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Render diagram]
  B -->|No| D[Show source]
  C --> E[Done]
  D --> E
```

## Sequence Diagram

```mermaid
sequenceDiagram
  participant U as User
  participant R as Ritemark
  participant M as Mermaid

  U->>R: Open markdown file
  R->>M: Render mermaid block
  M-->>R: SVG output
  R-->>U: Show diagram
```

## Class Diagram

```mermaid
classDiagram
  class Document {
    +String title
    +String status
    +save()
    +export()
  }

  class MermaidRenderer {
    +render(source)
    +toggleView()
  }

  Document --> MermaidRenderer : uses
```

## State Diagram

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Review
  Review --> Approved
  Review --> Draft : changes requested
  Approved --> Published
  Published --> [*]
```

## Entity Relationship Diagram

```mermaid
erDiagram
  CLIENT ||--o{ PROJECT : owns
  PROJECT ||--|{ DOCUMENT : contains
  DOCUMENT ||--o{ COMMENT : receives

  CLIENT {
    string name
    string org
  }

  PROJECT {
    string title
    string status
  }

  DOCUMENT {
    string title
    string type
  }
```

## Gantt Chart

```mermaid
gantt
  title Sprint 46 Mermaid Test
  dateFormat  YYYY-MM-DD
  section Build
  Install dependency     :done,    dep, 2026-03-20, 1d
  Fix node view          :done,    ui,  2026-03-21, 1d
  section QA
  Smoke test diagrams    :active,  qa,  2026-03-22, 2d
  Polish visuals         :         polish, after qa, 1d
```

## Pie Chart

```mermaid
pie title Feature Coverage
  "Flowchart" : 30
  "Sequence" : 20
  "State" : 15
  "ER" : 15
  "Gantt" : 20
```

## Invalid Diagram

```mermaid
flowchart TD
  A[Broken
  B --> C
```
