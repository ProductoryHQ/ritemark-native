#!/bin/bash
# Sprint 125 R1 — f5: fixture 01 saved by PowerPoint with the open password "ritemark"
# (an encrypted OOXML file, which is a CFB container, not a ZIP). macOS, Microsoft PowerPoint.
set -uo pipefail
S="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$S/scratch"
cp "$S/fixtures/01-title-bullets.pptx" "$S/scratch/f5-source.pptx"
rm -f "$S/fixtures/f5-password-protected.pptx"
perl -e 'alarm 720; exec @ARGV' osascript - "$S/scratch/f5-source.pptx" "$S/fixtures/f5-password-protected.pptx" <<'APPLESCRIPT'
on run argv
  set inPath to item 1 of argv
  set outPath to item 2 of argv
  set docName to "f5-source.pptx"
  set outName to "f5-password-protected.pptx"
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
      set password of p to "ritemark"
      save p in (POSIX file outPath) as save as Open XML presentation
      delay 1
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
echo "exit: $?"
xxd "$S/fixtures/f5-password-protected.pptx" | head -1
