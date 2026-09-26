/**
 * v1.12.0 RC fix — characters from Word's symbol fonts become Unicode.
 * Run: npx tsx webview/src/components/viewers/docx/symbolFonts.test.ts
 */
import assert from 'node:assert/strict';
import { isSymbolFont, mapNumberingSymbols, mapRunSymbols, mapSymbolChar } from './symbolFonts';

// mapSymbolChar: both forms Word writes, private-use slot and plain byte.
assert.equal(mapSymbolChar('Symbol', ''), '•');
assert.equal(mapSymbolChar('Symbol', '·'), '•');
assert.equal(mapSymbolChar('Symbol', 'a'), 'α');
assert.equal(mapSymbolChar('Wingdings', ''), '▪');
assert.equal(mapSymbolChar('Wingdings', ''), '✓');
assert.equal(mapSymbolChar('Wingdings', ''), '➢');
assert.equal(mapSymbolChar('wingdings', ''), '❖', 'font names are matched case-insensitively');
assert.equal(mapSymbolChar('Wingdings', ''), null, 'an unlisted Wingdings character stays unknown');
assert.equal(mapSymbolChar('Calibri', ''), null, 'not a symbol font');
assert.equal(mapSymbolChar('Symbol', '✓'), null, 'already Unicode');
assert.equal(isSymbolFont('Webdings'), true);
assert.equal(isSymbolFont('Arial'), false);

// mapNumberingSymbols: Word's default bullet library (Symbol •, Courier New o, Wingdings ▪).
const lvl = (text: string, font: string) =>
  `<w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="${text}"/><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:hint="default"/></w:rPr></w:lvl>`;
{
  const out = mapNumberingSymbols(lvl('', 'Symbol') + lvl('o', 'Courier New') + lvl('', 'Wingdings'));
  assert.ok(out.includes('<w:lvlText w:val="•"/>'), out);
  assert.ok(out.includes('<w:lvlText w:val="▪"/>'), out);
  assert.ok(out.includes('<w:lvlText w:val="o"/>'), 'a text-font bullet is kept');
  assert.ok(out.includes('w:ascii="Courier New"'), 'and so is its font');
  assert.ok(!/w:ascii="(?:Symbol|Wingdings)"/.test(out), 'symbol fonts are dropped');
  assert.ok(out.includes('<w:rFonts w:hint="default"/>') === false, 'an rFonts left with only a hint is removed');
}
// A numbered level in a symbol font keeps its placeholders.
assert.ok(mapNumberingSymbols(lvl('%1', 'Symbol')).includes('w:val="%1→"'));
// An unknown symbol-font marker becomes the bullet Word shows most often.
assert.ok(mapNumberingSymbols(lvl('', 'Wingdings')).includes('w:val="•"'));
// A level without a symbol font is untouched.
{
  const plain = lvl('-', 'Arial');
  assert.equal(mapNumberingSymbols(plain), plain);
}

// mapRunSymbols: w:sym elements.
assert.equal(mapRunSymbols('<w:r><w:sym w:font="Wingdings" w:char="F0FC"/></w:r>'), '<w:r><w:t xml:space="preserve">✓</w:t></w:r>');
assert.equal(mapRunSymbols('<w:r><w:sym w:font="Symbol" w:char="F0B7"/></w:r>'), '<w:r><w:t xml:space="preserve">•</w:t></w:r>');
{
  const unknown = '<w:r><w:sym w:font="Wingdings 2" w:char="F050"/></w:r>';
  assert.equal(mapRunSymbols(unknown), unknown, 'an unknown symbol is left as Word wrote it');
}
// Runs set in a symbol font.
assert.equal(
  mapRunSymbols('<w:r><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/><w:b/></w:rPr><w:t>abg</w:t></w:r>'),
  '<w:r><w:rPr><w:b/></w:rPr><w:t>αβγ</w:t></w:r>',
);
{
  const partly = '<w:r><w:rPr><w:rFonts w:ascii="Wingdings"/></w:rPr><w:t></w:t></w:r>';
  assert.equal(mapRunSymbols(partly), partly, 'a run with any unknown character is left whole');
}
// A w:sym already mapped inside a symbol-font run: the run is still cleaned.
assert.equal(
  mapRunSymbols('<w:r><w:rPr><w:rFonts w:ascii="Wingdings" w:hAnsi="Wingdings"/></w:rPr><w:sym w:font="Wingdings" w:char="F0FC"/></w:r>'),
  '<w:r><w:rPr></w:rPr><w:t xml:space="preserve">✓</w:t></w:r>',
);
// Text fonts are untouched; XML special characters survive.
{
  const text = '<w:r><w:rPr><w:rFonts w:ascii="Calibri"/></w:rPr><w:t>a &amp; b</w:t></w:r>';
  assert.equal(mapRunSymbols(text), text);
}
// A run holding a text box (nested runs) is not swallowed: the inner run is handled on its own.
{
  const nested =
    '<w:r><w:drawing><w:txbxContent><w:p><w:r><w:rPr><w:rFonts w:ascii="Symbol"/></w:rPr><w:t>p</w:t></w:r></w:p></w:txbxContent></w:drawing></w:r>';
  const out = mapRunSymbols(nested);
  assert.ok(out.includes('<w:t>π</w:t>'), out);
  assert.ok(out.startsWith('<w:r><w:drawing>'), 'the outer run is intact');
}

console.log('symbolFonts.test.ts: all passed');
