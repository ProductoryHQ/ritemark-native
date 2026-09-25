#!/bin/bash
# Sprint 125 R1 — a deck styled by PowerPoint itself, with one of its built-in design themes
# (Jarmo has no deck of his own to test with). PowerPoint opens fixture 01, applies the
# Berlin theme, and saves it: the theme's backgrounds, decorations, fonts and colours all
# come from PowerPoint, not from python-pptx.
#
#   bash ppt-themed.sh      -> ppt/11-powerpoint-themed.pptx and .pdf, ppt/png/11-*.png
#
# macOS, Microsoft PowerPoint. PowerPoint saves into a folder under /private/tmp (it could
# not write into the repository), and the files are copied here. As in ppt-ground-truth.sh,
# `open` is sent without waiting and the presentation is polled for by name, and only that
# presentation is closed, by name.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
THEME="/Applications/Microsoft PowerPoint.app/Contents/Resources/Office Themes/Berlin.thmx"
NAME=11-powerpoint-themed
WORK="$(mktemp -d /private/tmp/ritemark-ppt-themed.XXXXXX)"
cp "$HERE/fixtures/01-title-bullets.pptx" "$WORK/$NAME-source.pptx"

perl -e 'alarm 720; exec @ARGV' osascript - "$WORK/$NAME-source.pptx" "$THEME" "$WORK/$NAME.pptx" "$WORK/$NAME.pdf" <<'APPLESCRIPT'
on run argv
  set inPath to item 1 of argv
  set themePath to item 2 of argv
  set outPptx to item 3 of argv
  set outPdf to item 4 of argv
  set docName to "11-powerpoint-themed-source.pptx"
  set outName to "11-powerpoint-themed.pptx"
  tell application "Microsoft PowerPoint"
    ignoring application responses
      open (POSIX file inPath)
    end ignoring
    repeat 720 times
      with timeout of 10 seconds
        try
          if exists presentation docName then exit repeat
        end try
      end timeout
      delay 0.5
    end repeat
    with timeout of 120 seconds
      set p to presentation docName
      apply template p file name themePath
    end timeout
    with timeout of 180 seconds
      save p in (POSIX file outPdf) as save as PDF
    end timeout
    with timeout of 180 seconds
      if exists presentation docName then set p to presentation docName
      save p in (POSIX file outPptx) as save as Open XML presentation
    end timeout
    with timeout of 60 seconds
      if exists presentation outName then
        close presentation outName saving no
      else if exists presentation docName then
        close presentation docName saving no
      end if
    end timeout
  end tell
  return "ok"
end run
APPLESCRIPT
echo "osascript exit $?"
if [ ! -s "$WORK/$NAME.pdf" ] || [ ! -s "$WORK/$NAME.pptx" ]; then
  echo "PowerPoint wrote no files; see $WORK"
  exit 1
fi
cp "$WORK/$NAME.pptx" "$WORK/$NAME.pdf" "$HERE/ppt/"
# PowerPoint writes the saving user's name into the file; the corpus is public.
python3 "$HERE/scrub-metadata.py" "$HERE/ppt/$NAME.pptx" >/dev/null
mkdir -p "$HERE/ppt/png"
rm -f "$HERE"/ppt/png/"$NAME"-*.png
pdftoppm -r 96 -png "$HERE/ppt/$NAME.pdf" "$HERE/ppt/png/$NAME"
rm -rf "$WORK"
echo "slides: $(ls "$HERE"/ppt/png/"$NAME"-*.png | wc -l | tr -d ' ')  pptx: $(stat -f %z "$HERE/ppt/$NAME.pptx")"
