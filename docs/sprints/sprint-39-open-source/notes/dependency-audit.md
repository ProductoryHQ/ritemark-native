# Dependency License Audit

**Sprint:** 39 - Open Source Launch
**Date:** 2026-02-26

---

## Summary

All direct dependencies of the Ritemark extension use MIT or Apache 2.0 licenses. No GPL, LGPL, or AGPL dependencies were found. The project is safe to distribute under MIT.

## Direct Dependencies (`extensions/ritemark/package.json`)

| Package | License | Compatible with MIT? |
|---------|---------|---------------------|
| `@anthropic-ai/claude-agent-sdk` | MIT | Yes |
| `@orama/orama` | Apache 2.0 | Yes |
| `docx` | MIT | Yes |
| `gray-matter` | MIT | Yes |
| `marked` | MIT | Yes |
| `node-html-parser` | MIT | Yes |
| `openai` | Apache 2.0 | Yes |
| `papaparse` | MIT | Yes |
| `pdfkit` | MIT | Yes |
| `turndown` | MIT | Yes |
| `turndown-plugin-gfm` | MIT | Yes |
| `xlsx` (SheetJS) | Apache 2.0 | Yes |
| `zod` | MIT | Yes |

## Dev Dependencies

| Package | License | Notes |
|---------|---------|-------|
| `@types/node` | MIT | Type definitions only |
| `@types/papaparse` | MIT | Type definitions only |
| `@types/turndown` | MIT | Type definitions only |
| `@types/vscode` | MIT | Type definitions only |
| `lucide-static` | ISC | Compatible |
| `tsx` | MIT | Dev tool only |
| `typescript` | Apache 2.0 | Dev tool only |

## VS Code OSS

VS Code itself is licensed under MIT. Our patches modify VS Code source, which is permitted under MIT.

## Full Transitive Audit

For a complete transitive dependency audit, run:

```bash
cd extensions/ritemark
npx license-checker --summary
```

To check for problematic licenses specifically:

```bash
cd extensions/ritemark
npx license-checker --excludePrivatePackages --failOn "GPL;LGPL;AGPL"
```

## Risk Assessment

**Risk level: Low**

- All direct dependencies are MIT or Apache 2.0
- The project's tech stack (Node.js, TypeScript, React) tends toward permissive licenses
- No known copyleft dependencies in the dependency tree
- Recommended: Run `npx license-checker` before each release as a precaution
