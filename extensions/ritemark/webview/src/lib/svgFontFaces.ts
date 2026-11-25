/** The families a computed `font-family` names, without quotes. */
export function familiesOf(fontFamily: string): string[] {
  return fontFamily.split(',').map(name => name.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
}

/** The font face declaration for one of the requested families, as serialized by CSSOM. */
export function matchingFontFace(rule: CSSRule, families: ReadonlySet<string>): CSSFontFaceRule | undefined {
  if (!(rule instanceof CSSFontFaceRule)) return
  const family = familiesOf(rule.style.getPropertyValue('font-family'))[0]
  if (family && families.has(family)) return rule
}

export function* readableStyleSheets(doc: Document) {
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList
    try { rules = sheet.cssRules } catch { continue }
    yield { sheet, rules }
  }
}
