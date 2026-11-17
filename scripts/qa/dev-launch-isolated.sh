#!/usr/bin/env bash
# dev-launch-isolated.sh — start one Ritemark dev instance for a test run, isolated, and stop it again.
#
#   scripts/qa/dev-launch-isolated.sh start --name <run> [--folder <dir>] [--port <n>] [--env KEY=VALUE]...
#                                           [--user-data-dir=<new empty dir>] [--dry-run] [-- <extra Ritemark args>]
#   scripts/qa/dev-launch-isolated.sh stop <run-dir>
#
# `start` launches the dev build (vscode/.build/electron, built with the patches applied) of this checkout, or of the
# main checkout when this is a light worktree with an empty vscode/ (BUILD_ROOT says which), the way scripts/code.sh does, with everything a test run needs and nothing of the person's own:
#   - a new run folder under $TMPDIR (rm-<run>.XXXX) holding a fresh profile (--user-data-dir), a fresh
#     --extensions-dir, and throwaway AI homes: CLAUDE_CONFIG_DIR, CODEX_HOME and XDG_CONFIG/DATA/STATE/CACHE_HOME;
#   - its own --shared-data-dir, <run-dir>/shared, new and empty (never ~/.ritemark-shared, and since 8 Nov never the
#     dev builds' ~/.ritemark-dev-shared either: its Open Recent filled a fresh profile's Projects list with the person's
#     real folders, src/projects/firstFill.ts, and the window then read their files), and --use-mock-keychain;
#   - a free --remote-debugging-port (or --port), printed for the CDP scripts in scripts/qa;
#   - the profile's settings seeded so no native dialog or trust question can stop the run: the simple file
#     dialog, workspace trust off, no confirm before close;
#   - the folder on the command line, so the window opens on that project (a sample project of three Markdown
#     documents in the run folder when --folder is not given), visible, since a hidden window draws only the welcome;
#   - extra Ritemark/Chromium flags after `--`, placed after the folder (a value-less flag such as
#     --use-fake-ui-for-media-stream used to swallow the folder that followed it);
#   - each --env pair in the instance's environment (e.g. RITEMARK_SETTINGS_TIMING=1); ELECTRON_RUN_AS_NODE unset.
# HOME is never changed. It waits until the window has drawn the project (its title names the folder), then prints
# RUN_DIR, PORT, PID and FOLDER lines (also in <run-dir>/run.env) and returns, leaving the instance running.
#
# `stop` ends that instance: SIGTERM, then SIGKILL after 5 s, then every process still naming the run folder,
# and prints LEFT=0 when nothing is left (exit 1 otherwise). Then it removes the run folder (180–440 MB after a run;
# 3,100 left-behind folders filled the disk on 17–18 Nov), so copy any log or capture out of it first. It removes
# only that folder, and only when it is a run folder `start` made: directly in $TMPDIR, named rm-<run>.XXXX, its
# run.env naming it. It also removes it when the instance already quit by itself, and a second `stop` on a removed
# folder just checks that nothing is left. While a process is left, the folder is kept: run `stop` again.
# A caller's own --user-data-dir outside the run folder is never removed (the caller removes it).
# A `start` that fails removes its run folder too, before the launch or through `stop` after it; a --dry-run
# leaves its run folder (with a run.env, without a PID) for the caller to look at and remove with `stop`.
#
# Jarmo's rule (2 and 3 Nov): no test window while he is at the keyboard. From 08:00 to 18:00 Tallinn time
# `start` refuses unless RITEMARK_LAUNCH_DAYTIME_OK=1, which a run sets only after he has said yes in chat.
# What a launch may not change: see "What is guarded" in start_run.
# Test keys: this script loads none. A run that needs one uses scripts/qa/with-test-keys.sh around the launch, which
# wants the profile on the command line it runs: give it here as --user-data-dir=$RITEMARK_TEST_PROFILE (a new or empty
# folder, used instead of <run-dir>/profile and named in run.env as PROFILE), e.g.
#   RITEMARK_BUILD_CHANNEL=test RITEMARK_TEST_PROFILE=/private/tmp/rm-tk-profile \
#     scripts/qa/with-test-keys.sh --only gemini -- scripts/qa/dev-launch-isolated.sh start --name tk \
#       --user-data-dir=/private/tmp/rm-tk-profile
# The keys reach the instance only through its inherited environment; --env never carries one (it would be an argument).
#
# Model routing (ritemark-dev governance/model-routing.md, §2): a launch follows this script, so any model can
# run it the same way.

set -euo pipefail
set +x

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
die() { echo "dev-launch-isolated: $*" >&2; exit 2; }
# test_profile_check: where a test profile may be, the rule with-test-keys.sh uses for RITEMARK_TEST_PROFILE
# shellcheck source=test-profile-guard.sh
. "$ROOT/scripts/qa/test-profile-guard.sh"

# The text, with every extended-regular-expression character taken literally (for pgrep -f).
ere_escape() { printf '%s' "$1" | sed 's/[][\\.*^$+?(){}|]/\\&/g'; }

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

# A digest of a checkout's patches/vscode/*.patch (empty when it has none).
patch_digest() {
	(cd "$1/patches/vscode" 2>/dev/null && find . -type f -name '*.patch' -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -d" " -f1) || true
}

# The temp folder run folders go in, resolved (pwd -P), as start uses it.
temp_root() {
	(cd "${TMPDIR:-/private/tmp}" 2>/dev/null && pwd -P)
}

# Whether a folder may be removed as a run folder: given resolved, directly in the temp folder, named
# rm-<run>.XXXX (start's mktemp template), not a link. Prints why not and fails otherwise.
run_dir_check() {
	local dir=$1 tmp
	tmp=$(temp_root) || { echo "has no temp folder to be in (TMPDIR '${TMPDIR:-/private/tmp}')"; return 1; }
	[[ $(dirname "$dir") == "$tmp" ]] || { echo "is not directly in the temp folder $tmp"; return 1; }
	[[ $(basename "$dir") =~ ^rm-[A-Za-z0-9._-]+\.[A-Za-z0-9]{4}$ ]] || { echo "is not named rm-<run>.XXXX"; return 1; }
	[[ ! -L $dir ]] || { echo "is a link"; return 1; }
}

# Removes a run folder that passes run_dir_check, and nothing else.
remove_run_dir() {
	local dir=$1 why
	[[ -e $dir || -L $dir ]] || return 0
	if ! why=$(run_dir_check "$dir"); then
		echo "dev-launch-isolated: the run folder is not removed: '$dir' $why" >&2
		return 1
	fi
	rm -rf -- "$dir"
	if [[ -e $dir ]]; then
		echo "dev-launch-isolated: could not remove the run folder $dir" >&2
		return 1
	fi
}

stop_run() {
	local run_dir=${1:-} gone=0
	[[ -n $run_dir ]] || die "stop: give the run folder (RUN_DIR)"
	if [[ ! -e $run_dir ]]; then
		# A second stop, or a run folder removed some other way: only a run folder's name in the temp folder is
		# taken, and only the processes on its default profile are looked for (a caller's own profile is unknown).
		local parent why
		parent=$(cd "$(dirname "$run_dir")" 2>/dev/null && pwd -P) || die "stop: no run folder '$run_dir'"
		run_dir="$parent/$(basename "$run_dir")"
		why=$(run_dir_check "$run_dir") || die "stop: no run folder '$run_dir' (and it $why)"
		gone=1
	fi
	(( gone )) || [[ -f $run_dir/run.env ]] || die "stop: no run.env in '${run_dir}'"
	# One spelling of the folder: the profile flag names it as start resolved it (pwd -P, e.g. /private/var/…), and
	# a /var/… or …//… form of the same folder would match no process and report LEFT=0 with the instance running.
	(( gone )) || run_dir=$(cd "$run_dir" && pwd -P)
	local profile_dir=""
	(( gone )) || profile_dir=$(sed -n 's/^PROFILE=//p' "$run_dir/run.env")
	[[ -n $profile_dir ]] || profile_dir="$run_dir/profile"
	local profile="--user-data-dir=$profile_dir"
	# The flag matched whole: the exact value, after the start of the line or a space and before a space or the end,
	# and literally (a `.` in the folder is a dot). A run on …/rm-a.b/profile2 or …/rm-aXb/profile is another run's.
	local profile_re
	profile_re="(^| )$(ere_escape "$profile")( |\$)"
	local pid="" cmdline=""
	(( gone )) || pid=$(sed -n 's/^PID=//p' "$run_dir/run.env")
	# run.env's PID is used only while it is still this instance: a number, and a process whose command line
	# names the run's profile. A PID the system has since given to another process is never walked or signalled.
	[[ $pid =~ ^[0-9]+$ ]] && cmdline=$(ps -o command= -p "$pid" 2>/dev/null || true)
	[[ " $cmdline " == *" $profile "* ]] || pid=""
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
	more=$(pgrep -f -- "$profile_re" 2>/dev/null || true)
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
	more=$(pgrep -f -- "$profile_re" 2>/dev/null || true)
	[[ -n $more ]] && left=$((left + $(wc -l <<< "$more")))
	echo "LEFT=$left"
	if [[ $left != 0 ]]; then
		echo "dev-launch-isolated: $left processes are left, so the run folder is kept: run stop again" >&2
		return 1
	fi
	(( gone )) && { echo "REMOVED=$run_dir (already)"; return 0; }
	# Only the folder start made for this run: run.env names it, as start resolved it
	if [[ $(sed -n 's/^RUN_DIR=//p' "$run_dir/run.env") != "$run_dir" ]]; then
		echo "dev-launch-isolated: the run folder is not removed: its run.env does not name $run_dir" >&2
		return 1
	fi
	remove_run_dir "$run_dir" || return 1
	echo "REMOVED=$run_dir"
}

# The run folder of a start that has not launched yet, removed if start exits early (a refusal, a busy port).
# Cleared once an instance runs: from then on only stop removes it, after the instance has ended.
PENDING_RUN_DIR=""
remove_pending_run_dir() {
	[[ -n $PENDING_RUN_DIR ]] && remove_run_dir "$PENDING_RUN_DIR" || true
}
trap remove_pending_run_dir EXIT

start_run() {
	local name="" folder="" port="" dry_run=0 profile_arg=""
	local -a envs=() extra=()
	while [[ $# -gt 0 ]]; do
		case $1 in
			--name) name=${2:-}; shift 2 ;;
			--folder) folder=${2:-}; shift 2 ;;
			--port) port=${2:-}; shift 2 ;;
			--env) envs+=("${2:-}"); shift 2 ;;
			--user-data-dir=*) profile_arg=${1#--user-data-dir=}; shift ;;
			--user-data-dir) profile_arg=${2:-}; shift 2 ;;
			--dry-run) dry_run=1; shift ;;
			--) shift; extra=("$@"); break ;;
			*) die "unknown option '$1'" ;;
		esac
	done
	[[ $name =~ ^[A-Za-z0-9._-]+$ ]] || die "--name must be letters, digits, dot, dash or underscore"
	# What is guarded, before anything runs (second security review of #681), whoever calls:
	#   - a caller's --user-data-dir must pass with-test-keys.sh's rule (test_profile_check, test-profile-guard.sh):
	#     under a temp root, no whitespace, never Ritemark's real profile or ~/.ritemark-shared, nor inside them;
	#     without one, the profile is <run-dir>/profile, under $TMPDIR, which must have no whitespace either;
	#   - --shared-data-dir is always this run's own, <run-dir>/shared;
	#   - VSCODE_PORTABLE and VSCODE_APPDATA, which VS Code reads before --user-data-dir, may not be set, in this
	#     script's environment or through --env;
	#   - the extra arguments after `--` may not name --user-data-dir or --shared-data-dir (VS Code takes the last
	#     one given, which would replace the two above).
	# Not guarded: what the launched instance itself writes elsewhere (HOME is unchanged), and any VS Code variable
	# or flag besides these.
	if [[ -n $profile_arg ]]; then
		local why
		if ! why=$(test_profile_check "$profile_arg"); then die "refused: --user-data-dir $why"; fi
	fi
	local vscode_var
	if ! vscode_var=$(test_profile_env_check); then
		die "refused: $vscode_var is set; VS Code would take the profile from it, not from --user-data-dir (unset it)"
	fi
	local pair
	for pair in "${envs[@]+"${envs[@]}"}"; do
		[[ $pair =~ ^[A-Z_][A-Z0-9_]*=.*$ ]] || die "--env takes KEY=VALUE, got '$pair'"
		case ${pair%%=*} in
			HOME|CLAUDE_CONFIG_DIR|CODEX_HOME|XDG_*|ELECTRON_RUN_AS_NODE|VSCODE_PORTABLE|VSCODE_APPDATA) die "--env may not set ${pair%%=*}" ;;
		esac
	done
	local x
	for x in "${extra[@]+"${extra[@]}"}"; do
		case $x in
			-*user-data-dir*|-*shared-data-dir*) die "refused: the extra arguments may not name --user-data-dir or --shared-data-dir (got '${x%%=*}')" ;;
		esac
	done

	local hour
	hour=$(TZ=Europe/Tallinn date +%H)
	if (( 10#$hour >= 8 && 10#$hour < 18 )) && [[ ${RITEMARK_LAUNCH_DAYTIME_OK:-} != 1 ]] && (( ! dry_run )); then
		die "it is ${hour}:xx in Tallinn: a test window in the day needs Jarmo's yes in chat (then RITEMARK_LAUNCH_DAYTIME_OK=1)"
	fi

	# The dev build: this checkout's, or else the main checkout's, since a light .claude/worktrees/* checkout has an
	# empty vscode/ (the main checkout's build then runs the main checkout's extensions/ritemark through its link).
	local build_root="" r common
	common=$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)
	for r in "$ROOT" "$(dirname "${common:-$ROOT/.git}")"; do
		if [[ -x $r/vscode/.build/electron/Ritemark.app/Contents/MacOS/Ritemark ]]; then build_root=$r; break; fi
	done
	[[ -n $build_root ]] || die "no dev build in $ROOT/vscode or the main checkout's (build it first: vscode-development skill)"
	local app="$build_root/vscode/.build/electron/Ritemark.app/Contents/MacOS/Ritemark"
	# The build must be of the VS Code this checkout pins: a stale dev build (the main checkout's can be months old,
	# pre-2.0) opens a different app, and a run on it proves nothing. RITEMARK_LAUNCH_ANY_BUILD=1 skips the check.
	local pin built="" top
	pin=$(git -C "$ROOT" rev-parse --verify --quiet HEAD:vscode 2>/dev/null || true)
	# Only vscode/'s own checkout counts: a copy that lost its gitfile would otherwise report the Ritemark commit.
	top=$(git -C "$build_root/vscode" rev-parse --show-toplevel 2>/dev/null || true)
	if [[ -n $top && $(cd "$top" && pwd -P) == $(cd "$build_root/vscode" && pwd -P) ]]; then
		built=$(git -C "$build_root/vscode" rev-parse --verify --quiet HEAD 2>/dev/null || true)
	fi
	if [[ ( -z $pin || $built != "$pin" ) && ${RITEMARK_LAUNCH_ANY_BUILD:-} != 1 ]]; then
		die "the dev build in $build_root/vscode is of VS Code ${built:-unknown}, not the pinned ${pin:-unknown (no vscode gitlink in $ROOT)}: rebuild it, or give this worktree its own vscode (RITEMARK_LAUNCH_ANY_BUILD=1 to run it anyway)"
	fi
	# HEAD alone doesn't prove the build is of this code: Ritemark's shell changes are patches on a fixed HEAD.
	# (1) A fallback build must come from the same patch stack as this checkout's.
	# (2) Every patched VS Code source must be older than its compiled out/ file (a dev transpile or a full build).
	# Not proven: that the patches were re-applied after this checkout's patch files last changed (no marker for it).
	if [[ ${RITEMARK_LAUNCH_ANY_BUILD:-} != 1 ]]; then
		if [[ $build_root != "$ROOT" && $(patch_digest "$ROOT") != "$(patch_digest "$build_root")" ]]; then
			die "the main checkout's patches/vscode differ from this checkout's, so its build is not of this code: give this worktree its own vscode (RITEMARK_LAUNCH_ANY_BUILD=1 to run it anyway)"
		fi
		local f js stale=""
		while IFS= read -r f; do
			[[ $f == src/*.ts && $f != *.d.ts && $f != */test/* ]] || continue
			js="$build_root/vscode/out/${f#src/}"; js=${js%.ts}.js
			if [[ ! -f $js || $js -ot $build_root/vscode/$f ]]; then stale=$f; break; fi
		done < <(git -C "$build_root/vscode" diff --name-only HEAD 2>/dev/null || true; git -C "$build_root/vscode" ls-files --others --exclude-standard -- src 2>/dev/null || true)
		[[ -z $stale ]] || die "the dev build is older than vscode/$stale: rebuild or transpile it first (RITEMARK_LAUNCH_ANY_BUILD=1 to run it anyway)"
	fi

	local tmp=${TMPDIR:-/private/tmp}
	# stop matches the profile flag up to a space: a run folder with whitespace could match another run's
	[[ $tmp != *[[:space:]]* ]] || die "refused: TMPDIR must not contain whitespace"
	local run_dir
	run_dir=$(mktemp -d "${tmp%/}/rm-${name}.XXXX")
	run_dir=$(cd "$run_dir" && pwd -P)
	PENDING_RUN_DIR=$run_dir
	local profile_dir="$run_dir/profile"
	if [[ -n $profile_arg ]]; then
		# A profile of the caller's (a test profile, checked above): new or empty, never reused
		if [[ -e $profile_arg ]]; then
			[[ -d $profile_arg && -z $(ls -A "$profile_arg") ]] || die "--user-data-dir '$profile_arg' must be a new or empty folder"
		fi
		mkdir -p "$profile_arg"
		profile_dir=$(cd "$profile_arg" && pwd -P)
	fi
	mkdir -p "$run_dir"/{extensions,shared,claude,codex,xdg/config,xdg/data,xdg/state,xdg/cache} "$profile_dir/User"
	cat > "$profile_dir/User/settings.json" <<-'JSON'
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
		--user-data-dir="$profile_dir"
		--extensions-dir="$run_dir/extensions"
		--shared-data-dir="$run_dir/shared"
		--use-mock-keychain
		--remote-debugging-port="$port"
		"$folder"
		"${extra[@]+"${extra[@]}"}"
	)

	if (( dry_run )); then
		printf 'DRY_RUN '; printf '%q ' "${cmd[@]}"; echo
		echo "RUN_DIR=$run_dir"
		echo "BUILD_ROOT=$build_root"
		echo "BUILD_VSCODE=$built"
		# Kept for the caller to look at; `stop` removes it (a run.env without a PID: nothing to end)
		printf 'RUN_DIR=%s\nBUILD_ROOT=%s\nBUILD_VSCODE=%s\nFOLDER=%s\nPROFILE=%s\nDRY_RUN=1\n' \
			"$run_dir" "$build_root" "$built" "$folder" "$profile_dir" > "$run_dir/run.env"
		PENDING_RUN_DIR=""
		return 0
	fi

	# exec all the way down (nohup, env and arch each exec), so $! is the instance itself and no shell is left
	# holding this script's stdout open (a caller's $(...) would wait on it for ever).
	(cd "$build_root/vscode" && exec nohup "${cmd[@]}") > "$run_dir/stdout.log" 2>&1 < /dev/null &
	local pid=$!
	# An instance runs on the folder now: only stop removes it, once nothing is left running on it
	PENDING_RUN_DIR=""
	{
		echo "RUN_DIR=$run_dir"
		echo "BUILD_ROOT=$build_root"
		echo "BUILD_VSCODE=$built"
		echo "PORT=$port"
		echo "PID=$pid"
		echo "FOLDER=$folder"
		echo "PROFILE=$profile_dir"
	} > "$run_dir/run.env"

	local ready=0
	for _ in $(seq 1 120); do
		if ! alive "$pid"; then
			echo "dev-launch-isolated: the instance exited; the end of its stdout.log:" >&2
			tail -n 40 "$run_dir/stdout.log" >&2 || true
			cat "$run_dir/run.env"
			# Anything it left running is ended, and the run folder removed
			stop_run "$run_dir" >&2 || true
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
