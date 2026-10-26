# Third-Party Attribution

## Phosphor Icons

Ritemark Native bundles a curated subset of [Phosphor Icons](https://phosphoricons.com)
regular-weight SVG content in `extensions/ritemark/src/agent/iconPack.ts`.
Phosphor is the only icon library used in Ritemark — see
`.claude/skills/ritemark-design/references/iconography.md`.

Phosphor is distributed under the MIT licence.

### MIT Licence

```
MIT License

Copyright (c) 2023 Phosphor Icons

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Source: <https://github.com/phosphor-icons/core/blob/main/LICENSE>

## KaTeX

Ritemark typesets equations with [KaTeX](https://katex.org) 0.16.47 (Sprint 138, #481).
KaTeX's code is inside `extensions/ritemark/media/webview.js` (the copy Mermaid brings);
its stylesheet and fonts ship as files in `extensions/ritemark/media/katex/`, with
KaTeX's licence beside them (`media/katex/LICENSE`).

KaTeX and its fonts are distributed under the MIT licence.

```
The MIT License (MIT)

Copyright (c) 2013-2020 Khan Academy and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Source: <https://github.com/KaTeX/KaTeX/blob/main/LICENSE>

## mathml2omml

Ritemark turns equations into native Word equations with
[mathml2omml](https://github.com/fiduswriter/mathml2omml) 0.5.0 by Johannes Wilm
(Fidus Writer), Sprint 138 (#481).

mathml2omml is distributed under the **GNU Lesser General Public License, version 3
or later** (LGPL-3.0-or-later). Ritemark ships it **unmodified, as its own module**
(`extensions/ritemark/node_modules/mathml2omml/`), loaded at run time and kept out of
Ritemark's own bundle, so it can be replaced with a compatible version
(LGPL-3.0 §4(d)(1)). Its licence text is beside it
(`node_modules/mathml2omml/LICENSE`), and the GNU GPL version 3 that the LGPL
incorporates is in `extensions/ritemark/licenses/GPL-3.0.txt`. Its source is at the
link above. Ritemark's own code, including the wrapper that calls it
(`src/export/v2/mathToWord.ts`), stays under Ritemark's licence.

mathml2omml includes an XML parser and stringifier based on
[html-parse-stringify](https://github.com/henrikjoreteg/html-parse-stringify) (MIT).
