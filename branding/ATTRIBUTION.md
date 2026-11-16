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
both licences beside them: `media/katex/LICENSE` for the code and `media/katex/OFL.txt`
for the fonts.

KaTeX's code and stylesheet are distributed under the MIT licence, below.

KaTeX's fonts (`media/katex/fonts/*.woff2`) are distributed under the SIL Open Font
License, Version 1.1: Copyright (c) 2009-2010, Design Science, Inc.
(<www.mathjax.org>); Copyright (c) 2014-2018 Khan Academy (<www.khanacademy.org>);
with Reserved Font Names KaTeX_AMS, KaTeX_Caligraphic, KaTeX_Fraktur, KaTeX_Main,
KaTeX_Math, KaTeX_SansSerif, KaTeX_Script, KaTeX_Size1, KaTeX_Size2, KaTeX_Size3,
KaTeX_Size4 and KaTeX_Typewriter (from the fonts' own name tables). Ritemark ships
them unmodified; the licence text is in `media/katex/OFL.txt`.

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

## numfmt

The Excel preview formats numbers and dates with [numfmt](https://github.com/borgar/numfmt) 4.1.3 by Borgar Þorsteinsson
(Sprint 158, `webview/src/components/excel/numberFormat.ts`), built into `media/webview.js`.

numfmt is distributed under the MIT licence.

### MIT Licence

```
Copyright (c) 2020, Borgar Þorsteinsson <borgar@borgar.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Carlito and Caladea (the Excel preview's fonts)

The Excel preview draws Calibri and Cambria, on a computer without them, with their metric twins
[Carlito](https://github.com/googlefonts/carlito) by Łukasz Dziedzic and
[Caladea](https://github.com/huertatipografica/Caladea) by Carolina Giovagnoli and Andrés Torresi, taken from Google Fonts (`google/fonts`, `ofl/carlito` and `ofl/caladea`) in Sprint 158.

Ritemark ships **modified versions**: Latin subsets without hinting or layout features, made by
`docs/development/releases/v2.3.0/sprint-158-excel/research/proof/make-grid-fonts.py`. Carlito's licence reserves the
name "Carlito", so as the licence asks the subsets carry other names, **Ritemark Grid Sans** (from Carlito) and
**Ritemark Grid Serif** (from Caladea), and Caladea's are renamed the same way. Each keeps its copyright and licence
notices in its name table. They are `extensions/ritemark/webview/src/assets/fonts/RitemarkGrid*.woff2`, built into
`media/webview.js`.

- Carlito: Copyright 2013 The Carlito Project Authors (https://github.com/googlefonts/carlito), with Reserved Font Name
  "Carlito". "Carlito is a trademark of tyPoland Lukasz Dziedzic."
- Caladea: Copyright 2012 The Caladea Project Authors (https://github.com/huertatipografica/Caladea). "Caladea is a
  trademark of Carolina Giovagnoli & Andres Torresi."

Both are distributed under the SIL Open Font License, Version 1.1:

```
This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
