#!/bin/bash
# Packaged-build canary for v1.10.1 (Q4 typing race, Q6 geometry, Q7 empty task item, Q8 data loss, #194).
# Usage: packaged-canary.sh <Ritemark.app> <out-dir>
set -u
APP="$1"; OUT="$2"; mkdir -p "$OUT"
ROOT=/Users/jarmotuisk/Projects/ritemark-dev/ritemark-native
AB="npx --no-install --prefix $ROOT/vscode agent-browser"
export NODE_PATH="$ROOT/vscode/node_modules"
CE="$ROOT/.claude/skills/ritemark-automation/scripts/cdp-eval.js"
WS="$OUT/workspace"; UD="$OUT/userdata"; rm -rf "$WS" "$UD"; mkdir -p "$WS/bulk" "$UD/User"
echo '{"update.mode":"none","telemetry.telemetryLevel":"off"}' > "$UD/User/settings.json"
printf '# Plain\n\nText, no front matter.\n\n- alpha\n- beta\n' > "$WS/plain.md"
printf -- '---\ntitle: Has front matter\n---\n\n# With front matter\n\n- alpha\n- beta\n' > "$WS/frontmatter.md"
printf -- '- [ ] A\n\n- [x] B\n' > "$WS/tasks.md"
for i in $(seq -w 1 220); do printf '# Bulk %s\n\nfiller\n' "$i" > "$WS/bulk/a-$i.md"; touch -t 202601010000 "$WS/bulk/a-$i.md"; done
printf '# Newest\n\nnewest\n' > "$WS/zz-newest.md"; touch -t 202601150000 "$WS/plain.md"; touch -t 202602020000 "$WS/frontmatter.md"; touch -t 202603030000 "$WS/tasks.md"
HASH_BEFORE=$(shasum -a 256 "$WS/tasks.md" | cut -c1-16)
pass=0; fail=0; report() { if [ "$1" = ok ]; then pass=$((pass+1)); echo "PASS $2"; else fail=$((fail+1)); echo "FAIL $2 :: $3"; fi; }
ws_for() { curl -s http://localhost:9224/json/list | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));d.filter(t=>t.type==='iframe'&&!t.url.includes('purpose=webviewView')).forEach(t=>console.log(t.webSocketDebuggerUrl))" | while read -r X; do R=$(node "$CE" "$X" "(function(){const af=document.getElementById('active-frame'); if(!af||!af.contentDocument) return 'skip'; const pm=af.contentDocument.querySelector('.ProseMirror'); return pm&&new RegExp('$1').test(pm.innerText)?'hit':'skip';})()" 2>/dev/null | grep -o '"hit"'); [ -n "$R" ] && { echo "$X"; break; }; done; }
items() { node "$CE" "$1" "(function(){const pm=document.getElementById('active-frame').contentDocument.querySelector('.ProseMirror'); return JSON.stringify([...pm.querySelectorAll('li')].map(l=>l.textContent));})()" 2>/dev/null | grep -o '\[.*\]' | sed 's/\\"/"/g'; }
open_file() { local r; r=$($AB snapshot -i 2>&1 | grep -oE "treeitem \"$1\"[^]]*ref=e[0-9]+" | grep -oE 'e[0-9]+$' | head -1); $AB click "@$r" >/dev/null 2>&1; sleep 5; }
caret_after() { node "$CE" "$1" "(function(){const af=document.getElementById('active-frame'); const d=af.contentDocument,w=af.contentWindow; const pm=d.querySelector('.ProseMirror'); const li=[...pm.querySelectorAll('li')].find(l=>l.textContent==='$2'); const t=li.querySelector('p').firstChild; pm.focus(); const r=d.createRange(); r.setStart(t,$3); r.collapse(true); const s=w.getSelection(); s.removeAllRanges(); s.addRange(r); return 'ok';})()" >/dev/null 2>&1; }

lsof -t -i :9224 >/dev/null 2>&1 && { echo "port 9224 busy"; exit 1; }
"$APP/Contents/MacOS/Ritemark" --remote-debugging-port=9224 --user-data-dir="$UD" "$WS" > "$UD/launch.log" 2>&1 &
for i in $(seq 1 15); do $AB connect 9224 >/dev/null 2>&1 && break; sleep 3; done; sleep 5
T=$($AB snapshot -i 2>&1 | grep -c "trust the authors"); [ "$T" -eq 0 ] && report ok "no workspace-trust dialog" || report fail "trust dialog" "shown"
r=$($AB snapshot -i 2>&1 | grep -oE 'tab "File Browser[^]]*ref=e[0-9]+' | grep -oE 'e[0-9]+$' | head -1); $AB click "@$r" >/dev/null 2>&1; sleep 2

# Q4 — plain.md: burst without pauses, Enter mid-item, then undo/redo
open_file plain.md; W=$(ws_for 'Plain'); caret_after "$W" beta 2
$AB press Enter >/dev/null 2>&1; $AB keyboard type "gamma" >/dev/null 2>&1; $AB press Enter >/dev/null 2>&1; $AB keyboard type "delta" >/dev/null 2>&1; $AB press Enter >/dev/null 2>&1; $AB keyboard type "epsilon" >/dev/null 2>&1; sleep 3
got=$(items "$W"); [ "$got" = '["alpha","be","gamma","delta","epsilonta"]' ] && report ok "Q4 plain: burst with Enter mid-item intact" || report fail "Q4 plain burst" "$got"
$AB press Meta+z >/dev/null 2>&1; sleep 2; u1=$(items "$W")
$AB press Meta+Shift+z >/dev/null 2>&1; sleep 2; r1=$(items "$W")
[ "$r1" = '["alpha","be","gamma","delta","epsilonta"]' ] && [ "$u1" != "$r1" ] && report ok "Q4 plain: undo changes doc, redo restores it exactly (no duplication)" || report fail "Q4 plain undo/redo" "undo=$u1 redo=$r1"
$AB press Meta+s >/dev/null 2>&1; sleep 3; last=$(tail -c 1 "$WS/plain.md" | xxd -p); [ "$last" = "0a" ] && [ "$(tail -c 2 "$WS/plain.md" | xxd -p)" != "0a0a" ] && report ok "Q5 plain: saved file ends in exactly one newline" || report fail "Q5 plain newline" "$last"

# Q4 — frontmatter.md
open_file frontmatter.md; W=$(ws_for 'With front matter'); caret_after "$W" beta 2
$AB press Enter >/dev/null 2>&1; $AB keyboard type "gamma" >/dev/null 2>&1; $AB press Enter >/dev/null 2>&1; $AB keyboard type "delta" >/dev/null 2>&1; sleep 3
got=$(items "$W"); [ "$got" = '["alpha","be","gamma","deltata"]' ] && report ok "Q4 frontmatter: burst intact" || report fail "Q4 frontmatter burst" "$got"
$AB press Meta+z >/dev/null 2>&1; sleep 2; u1=$(items "$W"); $AB press Meta+Shift+z >/dev/null 2>&1; sleep 2; r1=$(items "$W")
[ "$r1" = '["alpha","be","gamma","deltata"]' ] && [ "$u1" != "$r1" ] && report ok "Q4 frontmatter: undo/redo clean" || report fail "Q4 frontmatter undo/redo" "undo=$u1 redo=$r1"
$AB press Meta+s >/dev/null 2>&1; sleep 3; head -3 "$WS/frontmatter.md" | grep -q '^title: Has front matter' && report ok "Q5 frontmatter: front matter preserved on save" || report fail "Q5 frontmatter" "$(head -3 "$WS/frontmatter.md")"

# Q6/Q8 — tasks.md
open_file tasks.md; W=$(ws_for '^A'); sleep 1
[ "$(shasum -a 256 "$WS/tasks.md" | cut -c1-16)" = "$HASH_BEFORE" ] && report ok "Q8 tasks: opening leaves the file untouched" || report fail "Q8 open" "hash changed"
g=$(node "$CE" "$W" "(function(){const d=document.getElementById('active-frame').contentDocument; const li=d.querySelector('li.tiptap-task-item'); const p=li.querySelector('div > p'); const lab=li.querySelector('label'); const rng=d.createRange(); rng.selectNodeContents(p); const tr=rng.getBoundingClientRect(), lr=lab.getBoundingClientRect(); return JSON.stringify({first:p.firstChild&&p.firstChild.nodeValue, dy:Math.round(Math.abs((lr.y+lr.height/2)-(tr.y+tr.height/2))), cbs:d.querySelectorAll('input[type=checkbox]').length, checked:d.querySelectorAll('input[type=checkbox]:checked').length});})()" 2>/dev/null | grep -o '{.*}' | sed 's/\\"/"/g'); echo "$g" | grep -q '"first":"A"' && echo "$g" | grep -qE '"dy":[0-3],' && echo "$g" | grep -q '"cbs":2,"checked":1' && report ok "Q6 tasks: text starts with A, checkbox/text on one row, 2 boxes 1 checked" || report fail "Q6 geometry" "$g"
$AB tab 0 >/dev/null 2>&1; $AB screenshot --full "$OUT/tasks.png" >/dev/null 2>&1
node "$CE" "$W" "(function(){document.getElementById('active-frame').contentDocument.querySelectorAll('input[type=checkbox]')[0].click(); return 'clicked';})()" >/dev/null 2>&1; sleep 1; $AB press Meta+s >/dev/null 2>&1; sleep 3
grep -q '^- \[x\] A' "$WS/tasks.md" && grep -q '^- \[x\] B' "$WS/tasks.md" && report ok "Q8 tasks: toggle + save writes - [x] A / - [x] B" || report fail "Q8 toggle" "$(cat "$WS/tasks.md")"

# Q7 — empty task item round trip in plain.md
open_file plain.md; W=$(ws_for 'Plain')
node "$CE" "$W" "(function(){const af=document.getElementById('active-frame'); const d=af.contentDocument,w=af.contentWindow; const pm=d.querySelector('.ProseMirror'); pm.focus(); const r=d.createRange(); r.selectNodeContents(pm); r.collapse(false); const s=w.getSelection(); s.removeAllRanges(); s.addRange(r); return 'end';})()" >/dev/null 2>&1
$AB press Enter >/dev/null 2>&1; $AB press Enter >/dev/null 2>&1; sleep 1; $AB keyboard type "/task" >/dev/null 2>&1; sleep 2; $AB press Enter >/dev/null 2>&1; sleep 3
c=$(node "$CE" "$W" "(function(){const pm=document.getElementById('active-frame').contentDocument.querySelector('.ProseMirror'); return JSON.stringify({cbs:pm.querySelectorAll('input[type=checkbox]').length, literal:/\\[ \\]/.test(pm.innerText)});})()" 2>/dev/null | grep -o '{.*}' | sed 's/\\"/"/g'); echo "$c" | grep -q '"cbs":1,"literal":false' && report ok "Q7: Slash → Task List creates a checkbox that survives autosave" || report fail "Q7 create" "$c"
$AB press Meta+s >/dev/null 2>&1; sleep 3; grep -q '^- \[ \]$' "$WS/plain.md" && report ok "Q7: empty item saved as bare - [ ]" || report fail "Q7 disk" "$(grep -n '\[' "$WS/plain.md")"
$AB press Meta+w >/dev/null 2>&1; sleep 2; open_file plain.md; W=$(ws_for 'Plain')
c=$(node "$CE" "$W" "(function(){const pm=document.getElementById('active-frame').contentDocument.querySelector('.ProseMirror'); return JSON.stringify({cbs:pm.querySelectorAll('input[type=checkbox]').length, literal:/\\[ \\]/.test(pm.innerText)});})()" 2>/dev/null | grep -o '{.*}' | sed 's/\\"/"/g'); echo "$c" | grep -q '"cbs":1,"literal":false' && report ok "Q7: empty item is a checkbox after reopen" || report fail "Q7 reopen" "$c"
node "$CE" "$W" "(function(){const af=document.getElementById('active-frame'); const d=af.contentDocument,w=af.contentWindow; const pm=d.querySelector('.ProseMirror'); const p=pm.querySelector('ul.tiptap-task-list li:last-child p'); pm.focus(); const r=d.createRange(); r.selectNodeContents(p); r.collapse(false); const s=w.getSelection(); s.removeAllRanges(); s.addRange(r); return 'ok';})()" >/dev/null 2>&1
$AB keyboard type "todo" >/dev/null 2>&1; sleep 1; $AB press Meta+s >/dev/null 2>&1; sleep 3; grep -q '^- \[ \] todo$' "$WS/plain.md" && report ok "Q7: typing into it saves - [ ] todo" || report fail "Q7 text" "$(grep -n '\[' "$WS/plain.md")"

# #194 — Home recents
r=$($AB snapshot -i 2>&1 | grep -oE 'tab "Home"[^]]*ref=e[0-9]+' | grep -oE 'e[0-9]+$' | head -1); $AB click "@$r" >/dev/null 2>&1; sleep 3
H=$(curl -s http://localhost:9224/json/list | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));d.filter(t=>t.type==='iframe').forEach(t=>console.log(t.webSocketDebuggerUrl))" | while read -r X; do R=$(node "$CE" "$X" "(function(){const af=document.getElementById('active-frame'); if(!af||!af.contentDocument) return ''; const t=af.contentDocument.body.innerText; return /RECENT DOCUMENTS/.test(t)?t.split('RECENT DOCUMENTS')[1].replace(/\s+/g,' ').trim().slice(0,120):'';})()" 2>/dev/null | grep -o '"value": "[^"]*"' | cut -d'"' -f4); [ -n "$R" ] && { echo "$R"; break; }; done); echo "$H" | grep -qE '^(zz-newest.md|plain.md) ' && ! echo "$H" | grep -q 'a-001' && report ok "#194 Home recents lead with the newest files, bulk excluded ($H)" || report fail "#194 recents" "$H"

$AB close >/dev/null 2>&1; pids=$(lsof -t -i :9224); [ -n "$pids" ] && kill $pids; sleep 1
echo "=== RESULT: $pass passed, $fail failed ==="; [ "$fail" -eq 0 ]
