#!/bin/bash
# Sprint 125 R1: PowerPoint ground truth for the corpus (macOS, Microsoft PowerPoint).
#
#   bash ppt-ground-truth.sh [01-title-bullets 05-charts ...]   (default: every NN-*.pptx)
#
# For each fixtures/NN-*.pptx, PowerPoint opens it, exports ppt/NN-*.pdf and re-saves it
# as ppt/NN-*.pptx (the "PowerPoint form": what a deck looks like after PowerPoint saved it).
# The PDF pages become ppt/png/NN-*-<n>.png via pdftoppm -r 96 (13.333 in -> 1280 px).
#
# Lessons: PowerPoint's `open` may never reply to the Apple Event, so it is sent without
# waiting and the presentation is polled for by name. Only presentations this script opened
# are closed, and only by name. perl's alarm bounds each file, so a pending dialog stops the
# run instead of hanging it.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
mkdir -p ppt ppt/png

ppt_export() { # <in.pptx> <out.pptx> <out.pdf>
  perl -e 'alarm 720; exec @ARGV' osascript - "$1" "$2" "$3" <<'APPLESCRIPT'
on run argv
  set inPath to item 1 of argv
  set outPptx to item 2 of argv
  set outPdf to item 3 of argv
  set AppleScript's text item delimiters to "/"
  set docName to last text item of inPath
  set outName to last text item of outPptx
  tell application "Microsoft PowerPoint"
    with timeout of 20 seconds
      set isOpen to exists presentation docName
    end timeout
    if not isOpen then
      ignoring application responses
        open (POSIX file inPath)
      end ignoring
    end if
    set t0 to current date
    repeat 720 times
      with timeout of 10 seconds
        try
          if exists presentation docName then exit repeat
        end try
      end timeout
      delay 0.5
    end repeat
    set t1 to current date
    with timeout of 180 seconds
      set p to presentation docName
      save p in (POSIX file outPdf) as save as PDF
    end timeout
    set t2 to current date
    with timeout of 180 seconds
      if exists presentation docName then set p to presentation docName
      save p in (POSIX file outPptx) as save as Open XML presentation
    end timeout
    set t3 to current date
    with timeout of 60 seconds
      -- After "save in", the presentation carries the new file's name (here the same base name).
      if exists presentation outName then
        close presentation outName saving no
      else if exists presentation docName then
        close presentation docName saving no
      end if
    end timeout
  end tell
  return "open " & (t1 - t0) & " s, pdf " & (t2 - t1) & " s, pptx " & (t3 - t2) & " s"
end run
APPLESCRIPT
}

if [ $# -gt 0 ]; then
  set -- $(printf 'fixtures/%s.pptx ' "$@")
else
  set -- fixtures/[0-9][0-9]-*.pptx
fi
for f in "$@"; do
  name=$(basename "$f" .pptx)
  echo "== $name  $(date +%T)"
  rm -f "ppt/$name.pdf" "ppt/$name.pptx"
  ppt_export "$HERE/$f" "$HERE/ppt/$name.pptx" "$HERE/ppt/$name.pdf"
  rc=$?
  echo "   osascript exit $rc"
  if [ ! -s "ppt/$name.pdf" ]; then
    echo "   NO PDF - stopping"
    exit 1
  fi
  # PowerPoint writes the saving user's name into the file; the corpus is public.
  python3 "$HERE/scrub-metadata.py" "ppt/$name.pptx" >/dev/null
  rm -f ppt/png/"$name"-*.png
  pdftoppm -r 96 -png "ppt/$name.pdf" "ppt/png/$name"
  echo "   slides: $(ls ppt/png/"$name"-*.png | wc -l | tr -d ' ')  pptx: $(stat -f %z "ppt/$name.pptx" 2>/dev/null || echo none)"
done
echo done
