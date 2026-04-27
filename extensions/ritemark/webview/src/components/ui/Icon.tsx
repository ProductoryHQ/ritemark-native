/**
 * Icon — Ritemark's only Phosphor import point.
 *
 * Source of truth: docs/development/sprints/sprint-52-design-foundations/notes/icons-usage.md
 * Design reference: docs-internal/design/ritemark-ui.pen frame yq4P8 (wins on disagreement).
 *
 * Rules (enforced by this component):
 *  - Family: Phosphor only. No direct `PhFolderOpen` imports at call sites.
 *  - Weight: 100 (thin). Locked; cannot be overridden per-icon.
 *  - Sizes: 12 / 14 / 16 / 20. No other values.
 *  - Tone: muted (default) / active / disabled, backed by --r-* CSS vars.
 */
import * as React from 'react'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowSquareOut,
  ArrowUpRight,
  ArrowsClockwise,
  ArrowsIn,
  Brain,
  Calendar,
  CaretDown,
  CaretRight,
  CaretUp,
  CaretUpDown,
  Chat,
  ChatCircle,
  Check,
  CheckCircle,
  CheckSquare,
  Circle,
  CircleNotch,
  Clipboard,
  ClipboardText,
  Clock,
  ClockCounterClockwise,
  Code,
  Copy,
  CurrencyDollar,
  Dot,
  DotsThree,
  Download,
  Eye,
  EyeSlash,
  File,
  FileCode,
  FileDoc,
  FileImage,
  FileText,
  FloppyDisk,
  FlowArrow,
  FolderOpen,
  Gear,
  GitBranch,
  GridNine,
  HardDrive,
  Image as ImageIcon,
  Info,
  Key,
  Lightning,
  LinkSimple,
  List,
  ListChecks,
  ListNumbers,
  LockSimple,
  MagnifyingGlass,
  Microphone,
  Minus,
  NotePencil,
  Palette,
  PaperPlaneRight,
  Paperclip,
  Paragraph,
  PencilSimple,
  Play,
  Plus,
  Question,
  Quotes,
  Robot,
  Rocket,
  Selection,
  ShieldCheck,
  SignIn,
  Sparkle,
  SquaresFour,
  Square,
  StarFour,
  Table,
  Terminal,
  TerminalWindow,
  TextHOne,
  TextHThree,
  TextHTwo,
  TextT,
  Timer,
  Trash,
  Warning,
  WarningCircle,
  WifiSlash,
  Wrench,
  X,
  XCircle,
  type Icon as PhosphorIconComponent,
} from '@phosphor-icons/react'

export type IconSize = 12 | 14 | 16 | 20
export type IconTone = 'muted' | 'active' | 'disabled'

const toneToColor: Record<IconTone, string> = {
  muted: 'var(--r-ink-muted)',
  active: 'var(--r-accent)',
  disabled: 'var(--r-ink-disabled)',
}

const iconMap = {
  'arrow-clockwise': ArrowClockwise,
  'arrow-counter-clockwise': ArrowCounterClockwise,
  'arrow-square-out': ArrowSquareOut,
  'arrow-up-right': ArrowUpRight,
  'arrows-clockwise': ArrowsClockwise,
  'arrows-in': ArrowsIn,
  'brain': Brain,
  'calendar': Calendar,
  'caret-down': CaretDown,
  'caret-right': CaretRight,
  'caret-up': CaretUp,
  'caret-up-down': CaretUpDown,
  'chat': Chat,
  'chat-circle': ChatCircle,
  'check': Check,
  'check-circle': CheckCircle,
  'check-square': CheckSquare,
  'circle': Circle,
  'circle-notch': CircleNotch,
  'clipboard': Clipboard,
  'clipboard-text': ClipboardText,
  'clock': Clock,
  'clock-counter-clockwise': ClockCounterClockwise,
  'code': Code,
  'copy': Copy,
  'currency-dollar': CurrencyDollar,
  'dot': Dot,
  'dots-three': DotsThree,
  'download': Download,
  'eye': Eye,
  'eye-slash': EyeSlash,
  'file': File,
  'file-code': FileCode,
  'file-doc': FileDoc,
  'file-image': FileImage,
  'file-text': FileText,
  'floppy-disk': FloppyDisk,
  'flow-arrow': FlowArrow,
  'folder-open': FolderOpen,
  'gear': Gear,
  'git-branch': GitBranch,
  'grid-nine': GridNine,
  'hard-drive': HardDrive,
  'image': ImageIcon,
  'info': Info,
  'key': Key,
  'lightning': Lightning,
  'link-simple': LinkSimple,
  'list': List,
  'list-checks': ListChecks,
  'list-numbers': ListNumbers,
  'lock-simple': LockSimple,
  'magnifying-glass': MagnifyingGlass,
  'microphone': Microphone,
  'minus': Minus,
  'note-pencil': NotePencil,
  'palette': Palette,
  'paper-plane-right': PaperPlaneRight,
  'paperclip': Paperclip,
  'paragraph': Paragraph,
  'pencil-simple': PencilSimple,
  'play': Play,
  'plus': Plus,
  'question': Question,
  'quotes': Quotes,
  'robot': Robot,
  'rocket': Rocket,
  'selection': Selection,
  'shield-check': ShieldCheck,
  'sign-in': SignIn,
  'sparkle': Sparkle,
  'square': Square,
  'squares-four': SquaresFour,
  'star-four': StarFour,
  'table': Table,
  'terminal': Terminal,
  'terminal-window': TerminalWindow,
  'text-h-one': TextHOne,
  'text-h-three': TextHThree,
  'text-h-two': TextHTwo,
  'text-t': TextT,
  'timer': Timer,
  'trash': Trash,
  'warning': Warning,
  'warning-circle': WarningCircle,
  'wifi-slash': WifiSlash,
  'wrench': Wrench,
  'x': X,
  'x-circle': XCircle,
} as const satisfies Record<string, PhosphorIconComponent>

export type PhosphorIconName = keyof typeof iconMap

export interface IconProps {
  name: PhosphorIconName
  size?: IconSize
  tone?: IconTone
  className?: string
  'aria-hidden'?: boolean
  'aria-label'?: string
}

export function Icon({
  name,
  size = 16,
  tone = 'muted',
  className,
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel,
}: IconProps): React.ReactElement {
  const Component = iconMap[name]
  const hiddenFromAria = ariaLabel ? undefined : ariaHidden ?? true
  return (
    <Component
      size={size}
      weight="thin"
      color={toneToColor[tone]}
      className={className}
      aria-hidden={hiddenFromAria}
      aria-label={ariaLabel}
    />
  )
}
