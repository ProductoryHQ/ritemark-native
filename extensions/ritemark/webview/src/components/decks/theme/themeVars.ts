/**
 * Sprint 157: a theme as a slide's CSS custom properties (`--s-*`), ported from the prototype's `themeVars`
 * (prototype.html:771-792). Two looks: the theme on its own ground (Card), and the theme's words, boxes and accents on
 * Ritemark's white surface (Borderless), where the headings take the theme's darkest colour and the accent is darkened
 * until it reads on white. A theme's hand-picked shades (`card`, `borderless`) win over the worked-out ones.
 */
import { deckFontStack, type DeckTheme } from '../../../../../src/decks/deckTheme'

type Rgb = [number, number, number]

const hex = (colour: string): Rgb => {
  const value = colour.replace('#', '')
  return [0, 2, 4].map(index => parseInt(value.substr(index, 2), 16)) as Rgb
}
const toHex = (rgb: number[]) => '#' + rgb.map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('').toUpperCase()
/** `t` is the share of `b`. */
export const mix = (a: string, b: string, t: number) => {
  const A = hex(a)
  const B = hex(b)
  return toHex(A.map((value, index) => value + (B[index] - value) * t))
}
const rgba = (colour: string, alpha: number) => `rgba(${hex(colour).join(',')},${alpha})`
const luminance = (colour: string) => {
  const [r, g, b] = hex(colour).map(value => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** WCAG contrast ratio of two colours. */
export const contrast = (a: string, b: string) => {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const isDark = (colour: string) => luminance(colour) < 0.2
/** Darker (or lighter) toward `target` until it reads on `ground` at `min` to 1. */
const toward = (colour: string, target: string, min: number, ground: string) => {
  let value = colour
  for (let index = 0; index < 24 && contrast(value, ground) < min; index++) value = mix(value, target, 0.12)
  return value
}

const WHITE = '#FFFFFF'
const RADII: Record<DeckTheme['round'], [number, number, number]> = { square: [3, 3, 4], soft: [14, 10, 20], round: [26, 18, 22] }

/**
 * Sprint 162 (step-3-themes.md, "The wall's bands"): the colour around the slide on a wall of another shape. A Card
 * deck's bands are its theme's ground at the darker end of its soft light (the plain ground when it has none), so the
 * slide reads as filling the wall; a Borderless deck's are its white.
 */
export function wallBand(theme: DeckTheme, borderless: boolean): string {
  if (borderless) return WHITE
  if (!theme.glow) return theme.bg
  return theme.card?.g3 || mix(theme.bg, '#000000', isDark(theme.bg) ? 0.3 : 0.03)
}

/** The slide's custom properties, without their `--s-` prefix. */
export function themeVars(theme: DeckTheme, borderless: boolean): Record<string, string> {
  const radius = RADII[theme.round] ?? RADII.soft
  const outline = theme.boxes === 'outline'
  let vars: Record<string, string>
  if (!borderless) {
    const bg = theme.bg
    const dark = isDark(bg)
    const ink = dark ? WHITE : theme.head
    const x = theme.card ?? {}
    const paper = !dark && contrast(bg, WHITE) < 1.04
    const lift = (a: number, b: number) => (dark ? rgba(WHITE, a) : paper ? rgba(ink, b) : WHITE)
    vars = {
      bg: theme.glow
        ? `radial-gradient(120% 95% at 88% 8%, ${x.g1 || mix(bg, dark ? WHITE : theme.accent, dark ? 0.16 : 0.07)} 0%, ${bg} 52%, ${x.g3 || mix(bg, '#000000', dark ? 0.3 : 0.03)} 100%)`
        : bg,
      hd: theme.head,
      tx: theme.text,
      sub: x.sub || mix(theme.text, bg, 0.16),
      fnt: x.fnt || mix(theme.text, bg, 0.28),
      acc: theme.accent,
      acct: dark ? theme.accent : toward(theme.accent, '#000000', 3, bg),
      accs: rgba(theme.accent, dark ? 0.16 : 0.14),
      accl: rgba(theme.accent, 0.55),
      box: outline ? 'transparent' : lift(0.07, 0.035),
      box2: outline ? 'transparent' : lift(0.06, 0.03),
      arw: lift(0.08, 0.05),
      boxl: rgba(ink, outline ? (dark ? 0.34 : 0.24) : dark ? 0.13 : 0.1),
      // The block bar's Style (17 November): a Boxes block's own Filled or Outline, whatever the theme's boxes are.
      boxf: lift(0.07, 0.035),
      boxfl: rgba(ink, dark ? 0.13 : 0.1),
      boxo: rgba(ink, dark ? 0.34 : 0.24),
      row: rgba(ink, dark ? 0.1 : 0.08),
      odd: rgba(ink, dark ? 0.03 : 0.025),
      thbg: rgba(theme.accent, dark ? 0.16 : 0.12),
      thfg: dark ? theme.accent : toward(theme.accent, '#000000', 4.5, bg),
      veil: `linear-gradient(90deg, ${rgba(bg, 0.92)} 0%, ${rgba(bg, 0.7)} 55%, ${rgba(bg, 0.35)} 100%)`,
      nm: bg,
      tagfg: contrast(bg, theme.accent) >= 3 ? bg : contrast(WHITE, theme.accent) >= contrast(theme.head, theme.accent) ? WHITE : theme.head,
      ring: rgba(ink, dark ? 0.18 : 0.14),
      foc: rgba(theme.accent, 0.7),
      ph: rgba(ink, dark ? 0.35 : 0.3),
      pic: lift(0.05, 0.04),
      emp: rgba(ink, dark ? 0.22 : 0.18),
      empt: rgba(ink, dark ? 0.6 : 0.5),
    }
  } else {
    const x = theme.borderless ?? {}
    const hd = x.hd || (contrast(theme.bg, WHITE) >= 4.5 ? theme.bg : toward(theme.head, '#000000', 4.5, WHITE))
    const dark = isDark(theme.bg)
    const acc = x.acc || toward(theme.accent, '#000000', 2.2, WHITE)
    const box = outline ? 'transparent' : x.box || mix(hd, WHITE, 0.96)
    vars = {
      bg: 'transparent',
      hd,
      tx: x.tx || (dark ? mix(hd, WHITE, 0.1) : toward(theme.text, '#000000', 4.5, WHITE)),
      sub: x.sub || (dark ? mix(hd, WHITE, 0.3) : toward(mix(theme.text, WHITE, 0.18), '#000000', 4.5, WHITE)),
      fnt: x.fnt || (dark ? mix(hd, WHITE, 0.3) : toward(mix(theme.text, WHITE, 0.25), '#000000', 4.5, WHITE)),
      acc,
      acct: x.acct || toward(theme.accent, '#000000', 3.5, WHITE),
      accs: rgba(theme.accent, 0.2),
      accl: rgba(acc, 0.5),
      box,
      box2: outline ? 'transparent' : x.box2 || box,
      arw: x.arw || mix(hd, WHITE, 0.94),
      boxl: x.boxl || mix(hd, WHITE, outline ? 0.74 : 0.9),
      // The theme's own line (`borderless.boxl`) is for its own style: a filled theme's is too faint for an outline.
      boxf: x.box || mix(hd, WHITE, 0.96),
      boxfl: (!outline && x.boxl) || mix(hd, WHITE, 0.9),
      boxo: (outline && x.boxl) || mix(hd, WHITE, 0.74),
      row: x.row || mix(hd, WHITE, 0.92),
      odd: x.odd || mix(hd, WHITE, 0.98),
      thbg: x.thbg || mix(theme.accent, WHITE, 0.82),
      thfg: x.thfg || toward(theme.accent, '#000000', 4.5, WHITE),
      veil: 'linear-gradient(90deg, rgba(255,255,255,.94) 0%, rgba(255,255,255,.78) 55%, rgba(255,255,255,.35) 100%)',
      nm: WHITE,
      tagfg: contrast(acc, hd) >= 3 ? hd : WHITE,
      ring: rgba(hd, 0.12),
      foc: rgba(acc, 0.75),
      ph: rgba(hd, 0.3),
      pic: x.pic || mix(hd, WHITE, 0.96),
      emp: x.emp || mix(hd, WHITE, 0.88),
      empt: x.empt || mix(hd, WHITE, 0.5),
    }
  }
  return {
    ...vars,
    // Sprint 162 PR 3: one of the six bundled fonts, whatever the name's case; any other name draws in Sofia Sans.
    fh: deckFontStack(theme.fh),
    fb: deckFontStack(theme.fb),
    r: `${radius[0]}px`,
    r2: `${radius[1]}px`,
    rt: `${radius[2]}px`,
  }
}

/** The properties as a React style object: `--s-bg`, `--s-hd`, … */
export function themeStyle(theme: DeckTheme, borderless: boolean): Record<string, string> {
  return Object.fromEntries(Object.entries(themeVars(theme, borderless)).map(([key, value]) => [`--s-${key}`, value]))
}
