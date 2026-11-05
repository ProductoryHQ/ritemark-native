#!/usr/bin/env bash
# dev-launch-isolated.sh — start one Ritemark dev instance for a test run, isolated, and stop it again.
#
#   scripts/qa/dev-launch-isolated.sh start --name <run> [--folder <dir>] [--port <n>] [--env KEY=VALUE]...
#                                           [--dry-run] [-- <extra Ritemark args>]
#   scripts/qa/dev-launch-isolated.sh stop <run-dir>
#
# `start` launches the dev build in this checkout (vscode/.build/electron, built with the patches applied) the
# way scripts/code.sh does, with everything a test run needs and nothing of the person's own:
#   - a new run folder under $TMPDIR (rm-<run>.XXXX) holding a fresh profile (--user-data-dir), a fresh
#     --extensions-dir, and throwaway AI homes: CLAUDE_CONFIG_DIR, CODEX_HOME and XDG_CONFIG/DATA/STATE/CACHE_HOME;
#   - --shared-data-dir ~/.ritemark-dev-shared (the dev builds' own, never ~/.ritemark-shared), --use-mock-keychain;
#   - a free --remote-debugging-port (or --port), printed for the CDP scripts in scripts/qa;
#   - the profile's settings seeded so no native dialog or trust question can stop the run: the simple file
#     dialog, workspace trust off, no confirm before close;
#   - the folder on the command line, so the window opens on that project (a sample project of three Markdown
#     documents in the run folder when --folder is not given), visible, since a hidden window draws only the welcome;
#   - each --env pair in the instance's environment (e.g. RITEMARK_SETTINGS_TIMING=1); ELECTRON_RUN_AS_NODE unset.
# HOME is never changed. It waits until the window has drawn the project (its title names the folder), then prints
# RUN_DIR, PORT, PID and FOLDER lines (also in <run-dir>/run.env) and returns, leaving the instance running.
#
# `stop` ends that instance: SIGTERM, then SIGKILL after 5 s, then every process still naming the run folder,
# and prints LEFT=0 when nothing is left (exit 1 otherwise). The run folder is kept for its logs and captures.
#
# Jarmo's rule (2 and 3 Nov): no test window while he is at the keyboard. From 08:00 to 18:00 Tallinn time
# `start` refuses unless RITEMARK_LAUNCH_DAYTIME_OK=1, which a run sets only after he has said yes in chat.
# Test keys: this script loads none. A run that needs one uses scripts/qa/with-test-keys.sh around the launch.
#
# Model routing (ritemark-dev governance/model-routing.md, §2): a launch follows this script, so any model can
# run it the same way.

set -euo pipefail
set +x

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
die() { echo "dev-launch-isolated: $*" >&2; exit 2; }

# A process that is running (not gone, not a zombie waiting to be reaped).
alive() {
	local s
	s=$(ps -o stat= -p "$1" 2>/dev/null || true)
	[[ -n $s && $s != Z* ]]
}

# The given pids and all their descendants, one per line.
descendants() {
	local queue=("$@") p kids
	while [[ ${#queue[@]} -gt 0 ]]; do
		p=${queue[0]}; queue=("${queue[@]:1}")
		[[ -n $p ]] || continue
		echo "$p"
		kids=$(pgrep -P "$p" 2>/dev/null || true)
		[[ -n $kids ]] && queue+=($kids)
	done
	return 0  # the loop's last `&&` may be false; under set -e a caller's $(...) would stop the script
}

stop_run() {
	local run_dir=${1:-}
	[[ -n $run_dir && -f $run_dir/run.env ]] || die "stop: no run.env in '${run_dir}'"
	local profile="--user-data-dir=$run_dir/profile"
	local pid cmdline=""
	pid=$(sed -n 's/^PID=//p' "$run_dir/run.env")
	# run.env's PID is used only while it is still this instance: a number, and a process whose command line
	# names the run's profile. A PID the system has since given to another process is never walked or signalled.
	[[ $pid =~ ^[0-9]+$ ]] && cmdline=$(ps -o command= -p "$pid" 2>/dev/null || true)
	[[ $cmdline == *"$profile"* ]] || pid=""
	# The instance's own tree (helpers, the extension host, the AI runtimes it started), gathered before the
	# main process goes and its children are re-parented; then every process naming the run's profile.
	# Never a pattern that matches this script's own command line, which names the run folder but not the profile flag.
	local tree="" p
	[[ -n $pid ]] && tree=$(descendants "$pid")
	if [[ -n $pid ]] && alive "$pid"; then
		kill -TERM "$pid" 2>/dev/null || true
		for _ in 1 2 3 4 5 6 7 8 9 10; do
			alive "$pid" || break
			sleep 0.5
		done
	fi
	# Walk again just before the KILL pass: runtimes started during the grace period hang under a pid already seen.
	local live="" more all
	for p in $tree; do alive "$p" && live="$live $p"; done
	more=$(pgrep -f -- "$profile" 2>/dev/null || true)
	all=$(descendants $live $more | sort -u)
	for p in $all; do
		[[ $p == "$$" ]] && continue
		kill -KILL "$p" 2>/dev/null || true
	done
	sleep 1
	local left=0
	for p in $all; do
		[[ $p == "$$" ]] && continue
		alive "$p" && left=$((left + 1))
	done
	more=$(pgrep -f -- "$profile" 2>/dev/null || true)
	[[ -n $more ]] && left=$((left + $(wc -l <<< "$more")))
	echo "LEFT=$left"
	[[ $left == 0 ]]
}

start_run() {
	local name="" folder="" port="" dry_run=0
	local -a envs=() extra=()
	while [[ $# -gt 0 ]]; do
		case $1 in
			--name) name=${2:-}; shift 2 ;;
			--folder) folder=${2:-}; shift 2 ;;
			--port) port=${2:-}; shift 2 ;;
			--env) envs+=("${2:-}"); shift 2 ;;
			--dry-run) dry_run=1; shift ;;
			--) shift; extra=("$@"); break ;;
			*) die "unknown option '$1'" ;;
		esac
	done
	[[ $name =~ ^[A-Za-z0-9._-]+$ ]] || die "--name must be letters, digits, dot, dash or underscore"
	local pair
	for pair in "${envs[@]+"${envs[@]}"}"; do
		[[ $pair =~ ^[A-Z_][A-Z0-9_]*=.*$ ]] || die "--env takes KEY=VALUE, got '$pair'"
		case ${pair%%=*} in
			HOME|CLAUDE_CONFIG_DIR|CODEX_HOME|XDG_*|ELECTRON_RUN_AS_NODE) die "--env may not set ${pair%%=*}" ;;
		esac
	done

	local hour
	hour=$(TZ=Europe/Tallinn date +%H)
	if (( 10#$hour >= 8 && 10#$hour < 18 )) && [[ ${RITEMARK_LAUNCH_DAYTIME_OK:-} != 1 ]] && (( ! dry_run )); then
		die "it is ${hour}:xx in Tallinn: a test window in the day needs Jarmo's yes in chat (then RITEMARK_LAUNCH_DAYTIME_OK=1)"
	fi

	local app="$ROOT/vscode/.build/electron/Ritemark.app/Contents/MacOS/Ritemark"
	[[ -x $app ]] || die "no dev build at $app (build it first: vscode-development skill)"

	local tmp=${TMPDIR:-/private/tmp}
	local run_dir
	run_dir=$(mktemp -d "${tmp%/}/rm-${name}.XXXX")
	run_dir=$(cd "$run_dir" && pwd -P)
	mkdir -p "$run_dir"/{profile/User,extensions,claude,codex,xdg/config,xdg/data,xdg/state,xdg/cache}
	cat > "$run_dir/profile/User/settings.json" <<-'JSON'
	{
		"files.simpleDialog.enable": true,
		"security.workspace.trust.enabled": false,
		"window.confirmBeforeClose": "never"
	}
	JSON

	if [[ -z $folder ]]; then
		folder="$run_dir/project"
		mkdir -p "$folder/notes"
		printf '# Sample project\n\nA folder of Markdown documents for a test run.\n' > "$folder/README.md"
		printf '# Meeting notes\n\n- First point\n- Second point\n' > "$folder/notes/meeting.md"
		printf '# Plan\n\n| Step | Owner |\n| --- | --- |\n| One | Ann |\n' > "$folder/notes/plan.md"
	fi
	[[ -d $folder ]] || die "--folder '$folder' is not a folder"
	folder=$(cd "$folder" && pwd -P)

	if [[ -z $port ]]; then
		port=$(python3 -I -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
	fi
	[[ $port =~ ^[0-9]+$ ]] || die "--port must be a number"
	if curl -s -m 1 "http://127.0.0.1:$port/json/version" >/dev/null 2>&1; then
		die "port $port already answers: another instance is listening there"
	fi

	local -a cmd=(
		env -u ELECTRON_RUN_AS_NODE
		NODE_ENV=development VSCODE_DEV=1 VSCODE_CLI=1 ELECTRON_ENABLE_STACK_DUMPING=1 ELECTRON_ENABLE_LOGGING=1
		CLAUDE_CONFIG_DIR="$run_dir/claude" CODEX_HOME="$run_dir/codex"
		XDG_CONFIG_HOME="$run_dir/xdg/config" XDG_DATA_HOME="$run_dir/xdg/data"
		XDG_STATE_HOME="$run_dir/xdg/state" XDG_CACHE_HOME="$run_dir/xdg/cache"
		"${envs[@]+"${envs[@]}"}"
		arch -arm64 "$app" .
		--disable-extension=vscode.vscode-api-tests
		--user-data-dir="$run_dir/profile"
		--extensions-dir="$run_dir/extensions"
		--shared-data-dir="$HOME/.ritemark-dev-shared"
		--use-mock-keychain
		--remote-debugging-port="$port"
		"${extra[@]+"${extra[@]}"}"
		"$folder"
	)

	if (( dry_run )); then
		printf 'DRY_RUN '; printf '%q ' "${cmd[@]}"; echo
		echo "RUN_DIR=$run_dir"
		return 0
	fi

	# exec all the way down (nohup, env and arch each exec), so $! is the instance itself and no shell is left
	# holding this script's stdout open (a caller's $(...) would wait on it for ever).
	(cd "$ROOT/vscode" && exec nohup "${cmd[@]}") > "$run_dir/stdout.log" 2>&1 < /dev/null &
	local pid=$!
	{
		echo "RUN_DIR=$run_dir"
		echo "PORT=$port"
		echo "PID=$pid"
		echo "FOLDER=$folder"
	} > "$run_dir/run.env"

	local ready=0
	for _ in $(seq 1 120); do
		if ! alive "$pid"; then
			echo "dev-launch-isolated: the instance exited; see $run_dir/stdout.log" >&2
			cat "$run_dir/run.env"
			exit 1
		fi
		local targets
		targets=$(curl -s -m 1 "http://127.0.0.1:$port/json/list" 2>/dev/null || true)
		# Ready = the workbench page has drawn the project: one of its title's " — " parts is the folder's name
		# ("Home — project"), compared whole and NFC-normalised, so a folder called Home or Ritemark can't match early.
		if python3 -I -c 'import json,sys,unicodedata
nfc=lambda s: unicodedata.normalize("NFC", s)
name=nfc(sys.argv[1])
try: targets=json.loads(sys.stdin.read() or "[]")
except ValueError: sys.exit(1)
def ready(x):
	parts=[p.strip() for p in nfc(x.get("title","")).split("—")]
	return x.get("type")=="page" and "workbench" in x.get("url","") and len(parts)>1 and name in parts[1:]
sys.exit(0 if any(ready(x) for x in targets) else 1)' "$(basename "$folder")" <<< "$targets"; then
			ready=1
			break
		fi
		sleep 0.5
	done
	cat "$run_dir/run.env"
	if (( ! ready )); then
		echo "dev-launch-isolated: no workbench page on port $port after 60 s; stopping it" >&2
		stop_run "$run_dir" || true
		exit 1
	fi
	echo "READY=1"
}

case ${1:-} in
	start) shift; start_run "$@" ;;
	stop) shift; stop_run "${1:-}" ;;
	*) die "usage: $0 start --name <run> [--folder <dir>] [--port <n>] [--env KEY=VALUE]... [--dry-run] [-- args] | stop <run-dir>" ;;
esac
