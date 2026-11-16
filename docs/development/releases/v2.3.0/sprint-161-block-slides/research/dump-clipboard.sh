#!/usr/bin/env bash
# dump-clipboard.sh — save every flavour on a macOS pasteboard into a folder, for the Sprint 161 spike (what Gamma
# puts on the clipboard when a card is copied).
#
#   research/dump-clipboard.sh <out-dir>                       the general clipboard (run only with the owner's yes)
#   research/dump-clipboard.sh --pasteboard <name> <out-dir>   a named pasteboard (the self-test uses one)
#
# Writes into <out-dir>, which must not exist yet or be empty:
#   types.txt                 every type on the pasteboard, in order, with its size in bytes
#   NN-<type>.bin             each type's raw bytes, as the pasteboard holds them (NN keeps the order)
#   class-HTML.html           AppleScript's «class HTML» read of the clipboard, decoded (general clipboard only)
#   public.html.html, public.rtf.rtf, public.utf8-plain-text.txt   the common ones again with readable extensions
# It reads the pasteboard and writes files; it sends nothing anywhere and changes nothing on the pasteboard.
# The capture may hold the owner's own content: keep it out of the repository (fixtures are made synthetic).

set -euo pipefail

board=""
if [[ ${1:-} == "--pasteboard" ]]; then
	board=${2:?--pasteboard needs a name}
	shift 2
fi
out=${1:?usage: dump-clipboard.sh [--pasteboard <name>] <out-dir>}
if [[ -e $out && -n $(ls -A "$out" 2>/dev/null) ]]; then
	echo "dump-clipboard: $out is not empty" >&2
	exit 2
fi
mkdir -p "$out"
out=$(cd "$out" && pwd)

# Every type and its bytes, through AppKit (JavaScript for Automation).
osascript -l JavaScript - "$out" "$board" <<'JXA'
ObjC.import('AppKit')
function run(argv) {
  const out = argv[0]
  const name = argv[1]
  const pb = name ? $.NSPasteboard.pasteboardWithName(name) : $.NSPasteboard.generalPasteboard
  const types = ObjC.deepUnwrap(pb.types) || []
  const lines = []
  types.forEach((type, index) => {
    const data = pb.dataForType(type)
    const size = data.isNil() ? 0 : Number(data.length)
    lines.push(`${String(index).padStart(2, '0')}\t${type}\t${size}`)
    if (data.isNil()) return
    const safe = type.replace(/[^A-Za-z0-9._-]/g, '_')
    data.writeToFileAtomically(`${out}/${String(index).padStart(2, '0')}-${safe}.bin`, true)
    const readable = { 'public.html': 'public.html.html', 'public.rtf': 'public.rtf.rtf', 'public.utf8-plain-text': 'public.utf8-plain-text.txt' }[type]
    if (readable) data.writeToFileAtomically(`${out}/${readable}`, true)
  })
  $.NSString.alloc.initWithUTF8String(lines.join('\n') + '\n').writeToFileAtomicallyEncodingError(`${out}/types.txt`, true, $.NSUTF8StringEncoding, null)
  return `${types.length} types`
}
JXA

# The general clipboard's «class HTML», as AppleScript reads it (hex data), decoded. A named pasteboard has no such read.
if [[ -z $board ]]; then
	hex=$(osascript -e 'try' -e 'the clipboard as «class HTML»' -e 'on error' -e 'return ""' -e 'end try' 2>/dev/null || true)
	hex=${hex#«data HTML}
	hex=${hex%»}
	if [[ -n $hex ]]; then
		printf '%s' "$hex" | xxd -r -p > "$out/class-HTML.html"
	fi
fi

echo "dump-clipboard: wrote $(ls "$out" | wc -l | tr -d ' ') files to $out"
cat "$out/types.txt"
