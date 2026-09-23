#!/bin/bash
# Sprint 124 R1: Word ground truth for the corpus (macOS with Microsoft Word).
#
# For each fixtures/NN-*.docx, Word opens it, re-saves it as word/NN-*.docx
# (Word adds its saved page markers, <w:lastRenderedPageBreak/>), and exports
# word/NN-*.pdf. The PDF pages become word/png/NN-*-<page>.png via pdftoppm.
# It also writes fixtures/f3-password-protected.docx (password "ritemark").
#
# The first run asks macOS for permission to control Microsoft Word.
set -euo pipefail
cd "$(dirname "$0")"
HERE="$PWD"
mkdir -p word word/png

word_save() { # <in.docx> <out.docx> <out.pdf|-> [password]
  osascript - "$1" "$2" "$3" "${4:-}" <<'APPLESCRIPT'
on run argv
  set inPath to item 1 of argv
  set outDocx to item 2 of argv
  set outPdf to item 3 of argv
  set pw to item 4 of argv
  tell application "Microsoft Word"
    open (POSIX file inPath)
    -- Word opens asynchronously, slowest on its first launch.
    repeat 60 times
      if (count of documents) > 0 then exit repeat
      delay 0.5
    end repeat
    set d to active document
    if pw is "" then
      save as d file name outDocx file format format document default
    else
      save as d file name outDocx file format format document default password pw
    end if
    if outPdf is not "-" then
      save as d file name outPdf file format format PDF
    end if
    close d saving no
  end tell
end run
APPLESCRIPT
}

for f in fixtures/[0-9][0-9]-*.docx; do
  name=$(basename "$f" .docx)
  echo "== $name"
  word_save "$HERE/$f" "$HERE/word/$name.docx" "$HERE/word/$name.pdf"
  rm -f word/png/"$name"-*.png
  pdftoppm -r 96 -png "word/$name.pdf" "word/png/$name"
  echo "   pages: $(ls word/png/"$name"-*.png | wc -l | tr -d ' ')"
done

echo "== f3-password-protected"
word_save "$HERE/fixtures/01-headings-styles.docx" "$HERE/fixtures/f3-password-protected.docx" "-" "ritemark"
echo done
