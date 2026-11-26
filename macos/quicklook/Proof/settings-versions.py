"""Aggregate the screen evidence and check the app's checked-in version gate."""

import json
from pathlib import Path
import sys


def main():
    artifacts, gate, report = map(Path, sys.argv[1:])
    variants = {"macos-15": (15, "arm64"), "macos-26": (26, "arm64"),
                "macos-26-intel": (26, "x86_64")}
    outcomes = {}
    lines = ["# Quick Look System Settings proof", ""]
    for runner, (major, expected_cpu) in variants.items():
        evidence = artifacts / f"quicklook-{runner}" / "settings.tsv"
        try:
            version, cpu, state, method = evidence.read_text().strip().split("\t")
            if (int(version.split(".")[0]), cpu) != (major, expected_cpu):
                raise ValueError(f"unexpected runner OS or architecture ({version}, {cpu})")
            if state not in ("confirmed", "gap", "failed"):
                raise ValueError(f"unknown Settings outcome {state!r}")
        except (OSError, ValueError) as error:
            version, cpu, state = str(major), expected_cpu, "missing"
            lines.append(f"- {runner} — missing or invalid evidence ({error})")
        else:
            detail = f" via {method}" if state == "confirmed" else ""
            lines.append(f"- {runner} — macOS {version} · {cpu} · {state}{detail}")
        outcomes.setdefault(major, []).append(state)

    confirmed = sorted(major for major, states in outcomes.items()
                       if all(state == "confirmed" for state in states))
    lines.extend(("", f"confirmed-settings-versions: {json.dumps(confirmed)}"))
    checked_in = json.loads(gate.read_text())
    matches = checked_in == confirmed
    if not matches:
        lines.extend(("", f"Version gate drift: checked in {json.dumps(checked_in)}."))
    report.write_text("\n".join(lines) + "\n")
    print(report.read_text(), end="")
    return 0 if matches else 1


if __name__ == "__main__":
    sys.exit(main())
