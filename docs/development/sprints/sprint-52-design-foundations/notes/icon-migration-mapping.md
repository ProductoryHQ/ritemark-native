# Lucide → Phosphor migration mapping

**Source:** all 90 distinct Lucide component names imported across Ritemark `extensions/ritemark/**/*.{ts,tsx}`.
**Target:** Phosphor equivalents, all rendered at weight `thin` via `components/ui/Icon.tsx`.
**Authority:** `notes/icons-usage.md` + `.pen` `yq4P8`. This file is the **runtime mapping**; disagreements resolve in favor of the `.pen`.

| Lucide (PascalCase) | Phosphor (PascalCase) | Icon name (kebab-case) | Notes |
|---|---|---|---|
| `AlertCircle` | `WarningCircle` | `warning-circle` | |
| `AlertTriangle` | `Warning` | `warning` | Per icons-usage.md rename |
| `ArrowUpRight` | `ArrowUpRight` | `arrow-up-right` | |
| `Bot` | `Robot` | `robot` | Per rename table |
| `Brain` | `Brain` | `brain` | |
| `Calendar` | `Calendar` | `calendar` | |
| `Check` | `Check` | `check` | |
| `CheckCircle` | `CheckCircle` | `check-circle` | |
| `CheckCircle2` | `CheckCircle` | `check-circle` | Lucide's "filled" variant collapses to thin-weight CheckCircle |
| `CheckSquare` | `CheckSquare` | `check-square` | |
| `ChevronDown` | `CaretDown` | `caret-down` | Per rename table |
| `ChevronRight` | `CaretRight` | `caret-right` | Per rename table |
| `ChevronUp` | `CaretUp` | `caret-up` | Per rename table |
| `ChevronsUpDown` | `CaretUpDown` | `caret-up-down` | |
| `Circle` | `Circle` | `circle` | |
| `Clipboard` | `Clipboard` | `clipboard` | |
| `ClipboardCheck` | `ClipboardText` | `clipboard-text` | No direct Phosphor "clipboard + check"; `clipboard-text` is the closest semantic match |
| `ClipboardList` | `ClipboardText` | `clipboard-text` | |
| `Clock3` | `Clock` | `clock` | |
| `Code` | `Code` | `code` | |
| `Copy` | `Copy` | `copy` | |
| `DollarSign` | `CurrencyDollar` | `currency-dollar` | |
| `Dot` | `Dot` | `dot` | |
| `Download` | `Download` | `download` | |
| `ExternalLink` | `ArrowSquareOut` | `arrow-square-out` | Per rename table |
| `Eye` | `Eye` | `eye` | |
| `EyeOff` | `EyeSlash` | `eye-slash` | |
| `File` | `File` | `file` | |
| `FileCode` | `FileCode` | `file-code` | |
| `FileImage` | `FileImage` | `file-image` | |
| `FileText` | `FileText` | `file-text` | |
| `FileType` | `FileDoc` | `file-doc` | Lucide's generic "document" maps to Phosphor file-doc |
| `FolderOpen` | `FolderOpen` | `folder-open` | |
| `GitBranch` | `GitBranch` | `git-branch` | |
| `Grid3X3` | `GridNine` | `grid-nine` | 3×3 grid semantics |
| `HardDrive` | `HardDrive` | `hard-drive` | |
| `Heading1` | `TextHOne` | `text-h-one` | |
| `Heading2` | `TextHTwo` | `text-h-two` | |
| `Heading3` | `TextHThree` | `text-h-three` | |
| `HelpCircle` | `Question` | `question` | Phosphor's question-mark-in-circle |
| `History` | `ClockCounterClockwise` | `clock-counter-clockwise` | Per icons-usage.md status/meta mapping |
| `Image` | `Image` | `image` | Import alias: `Image as ImageIcon` inside Icon.tsx to avoid clashing with DOM `Image` |
| `ImageIcon` | `Image` | `image` | Lucide alias; same target as `Image` |
| `Key` | `Key` | `key` | |
| `LayoutGrid` | `SquaresFour` | `squares-four` | 2×2 card-layout semantics |
| `Link2` | `LinkSimple` | `link-simple` | |
| `List` | `List` | `list` | |
| `ListChecks` | `ListChecks` | `list-checks` | |
| `ListOrdered` | `ListNumbers` | `list-numbers` | |
| `Loader2` | `CircleNotch` | `circle-notch` | Classic spinner; callers wrap with `animate-spin` |
| `LogIn` | `SignIn` | `sign-in` | |
| `MessageCircle` | `ChatCircle` | `chat-circle` | |
| `MessageSquare` | `Chat` | `chat` | |
| `MessageSquarePlus` | `NotePencil` | `note-pencil` | Phosphor has no direct "new-chat" glyph; `note-pencil` conveys compose intent |
| `Mic` | `Microphone` | `microphone` | Per icons-usage.md |
| `Mic2` | `Microphone` | `microphone` | Lucide's alt-mic collapses to the same thin-weight Microphone |
| `Minimize2` | `ArrowsIn` | `arrows-in` | |
| `Minus` | `Minus` | `minus` | |
| `MoreHorizontal` | `DotsThree` | `dots-three` | Per icons-usage.md |
| `Palette` | `Palette` | `palette` | |
| `Paperclip` | `Paperclip` | `paperclip` | |
| `Pencil` | `PencilSimple` | `pencil-simple` | Consistent with `edit-3 → pencil-simple` rename |
| `Pilcrow` | `Paragraph` | `paragraph` | |
| `Play` | `Play` | `play` | |
| `Plus` | `Plus` | `plus` | |
| `Quote` | `Quotes` | `quotes` | |
| `RefreshCw` | `ArrowsClockwise` | `arrows-clockwise` | Per icons-usage.md toolbar mapping |
| `Rocket` | `Rocket` | `rocket` | |
| `RotateCcw` | `ArrowCounterClockwise` | `arrow-counter-clockwise` | Single arrow (Lucide RotateCcw is single-arrow) |
| `RotateCw` | `ArrowClockwise` | `arrow-clockwise` | Single arrow |
| `Save` | `FloppyDisk` | `floppy-disk` | |
| `Search` | `MagnifyingGlass` | `magnifying-glass` | Per rename table |
| `Send` | `PaperPlaneRight` | `paper-plane-right` | |
| `Settings` | `Gear` | `gear` | Per rename table |
| `ShieldCheck` | `ShieldCheck` | `shield-check` | |
| `Sparkles` | `StarFour` | `star-four` | Per icons-usage.md AI-sidebar mapping |
| `Square` | `Square` | `square` | |
| `Table` | `Table` | `table` | |
| `Table2` | `Table` | `table` | |
| `Terminal` | `Terminal` | `terminal` | |
| `TerminalSquare` | `TerminalWindow` | `terminal-window` | |
| `TextSelect` | `Selection` | `selection` | |
| `Timer` | `Timer` | `timer` | |
| `Trash2` | `Trash` | `trash` | Per rename table |
| `Type` | `TextT` | `text-t` | Phosphor's typography "T" |
| `WifiOff` | `WifiSlash` | `wifi-slash` | |
| `Wrench` | `Wrench` | `wrench` | |
| `X` | `X` | `x` | |
| `XCircle` | `XCircle` | `x-circle` | |
| `Zap` | `Lightning` | `lightning` | |

## Rules for future additions

1. New icons go into `iconMap` in `components/ui/Icon.tsx` AND this table in the same commit.
2. If a Phosphor name is not obvious, check `notes/icons-usage.md` surface→icon mapping first; extend it if the new surface genuinely needs a new slot.
3. If no Phosphor glyph matches, raise with Jarmo before drawing custom SVG (per `notes/icons-usage.md` Exceptions section).
