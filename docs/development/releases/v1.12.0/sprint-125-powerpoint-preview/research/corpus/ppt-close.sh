#!/bin/bash
# Close, by name and without saving, only the corpus presentations this session opened.
perl -e 'alarm 60; exec @ARGV' osascript -e 'with timeout of 50 seconds
tell application "Microsoft PowerPoint"
set closed to {}
repeat with n in {"01-title-bullets.pptx", "02-tables.pptx", "03-images.pptx", "04-shapes-groups.pptx", "05-charts.pptx", "06-fonts.pptx", "07-notes.pptx", "08-long-40-slides.pptx", "09-layouts-backgrounds.pptx", "f5-source.pptx", "f5-password-protected.pptx"}
if exists presentation (n as text) then
close presentation (n as text) saving no
set end of closed to (n as text)
end if
end repeat
return closed
end tell
end timeout' 2>&1
echo "exit: $?"
