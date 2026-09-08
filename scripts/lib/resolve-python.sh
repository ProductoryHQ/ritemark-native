#!/usr/bin/env bash
# =============================================================================
# Shared Python interpreter resolution
# =============================================================================
# Windows runners and many Git Bash / PowerShell setups expose only `python`,
# not `python3`, so probing both is required. But on Windows `command -v` is
# not enough: C:\Users\<user>\AppData\Local\Microsoft\WindowsApps\python3 is a
# Microsoft Store "App Execution Alias" stub. It exists, `command -v` exits 0,
# and it gets selected -- yet running it only prints the localized
# "Python was not found; install it from the Microsoft Store..." message and
# exits 49, aborting the caller. The real interpreter (e.g.
# %LOCALAPPDATA%\Programs\Python\Python311\python.exe, also reachable via the
# `py` launcher) is never tried.
#
# So: skip WindowsApps stubs, prove the candidate actually executes, and fall
# back to the `py -3` launcher.
#
# Source this file; do not execute it.
# =============================================================================

# The Store aliases live under .../Microsoft/WindowsApps/. Matched with
# `nocasematch` rather than a `tr` pipeline: this runs before PATH is known to
# be sane, and `case` with a quoted pattern is a literal, builtin-only compare
# that also works on macOS's bash 3.2.
ritemark_python_is_store_stub() {
  local rc=1 saved
  saved="$(shopt -p nocasematch || true)"  # exits 1 when unset
  shopt -s nocasematch
  case "$1" in
    */windowsapps/*) rc=0 ;;
  esac
  eval "${saved:-}"
  return "$rc"
}

ritemark_python_runs() {
  "$1" -c 'import sys; sys.exit(0)' >/dev/null 2>&1
}

# Echo a usable interpreter command, or return 1 when none is found.
ritemark_resolve_python() {
  local py resolved exe

  for py in python3 python; do
    resolved="$(command -v "$py" 2>/dev/null)" || continue
    ritemark_python_is_store_stub "$resolved" && continue
    ritemark_python_runs "$py" || continue
    printf '%s\n' "$py"
    return 0
  done

  # Windows `py` launcher: the way to reach the real interpreter when only
  # Store stubs sit on PATH. Resolve it to a concrete executable so callers can
  # keep treating the result as a single command word.
  if command -v py >/dev/null 2>&1; then
    exe="$(py -3 -c 'import sys; print(sys.executable)' 2>/dev/null)" || exe=""
    if [ -n "$exe" ]; then
      if command -v cygpath >/dev/null 2>&1; then
        exe="$(cygpath -u "$exe" 2>/dev/null || printf '%s' "$exe")"
      fi
      if ritemark_python_runs "$exe"; then
        printf '%s\n' "$exe"
        return 0
      fi
    fi
  fi

  return 1
}

# Shared failure text so every caller reports the Store-stub trap the same way.
ritemark_python_not_found_message() {
  echo "ERROR: no working Python interpreter found in PATH" >&2
  echo "  Checked: python3, python, and the Windows 'py -3' launcher." >&2
  echo "  Microsoft Store alias stubs under ...\\Microsoft\\WindowsApps\\ are" >&2
  echo "  skipped on purpose: they resolve but only print 'Python was not" >&2
  echo "  found' and exit 49. Install Python from python.org (or disable the" >&2
  echo "  App Execution Aliases for python/python3 in Windows Settings)." >&2
}
