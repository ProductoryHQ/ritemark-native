#!/usr/bin/env python3
"""Read committed inventory and working-file sizes; write only audit evidence."""

import hashlib
import json
from pathlib import Path
import subprocess


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT).decode().strip()


ROOT = Path(__file__).resolve().parents[5]
tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
tracked = [name for name in tracked if name]


def source_inventory(prefix):
    names = [name for name in tracked if name.startswith(prefix) and name.endswith((".ts", ".tsx"))]
    tests = [name for name in names if ".test." in name or ".spec." in name]
    modules = [name for name in names if name not in tests]
    sizes = []
    for name in modules:
        data = (ROOT / name).read_bytes()
        sizes.append({"path": name, "bytes": len(data), "lines": len(data.splitlines())})
    return {
        "tracked_typescript_files": len(names),
        "test_files": len(tests),
        "non_test_files": len(modules),
        "non_test_lines": sum(item["lines"] for item in sizes),
        "largest_by_lines": sorted(sizes, key=lambda item: (-item["lines"], item["path"]))[:10],
    }


def artifact(name):
    file = ROOT / name
    if not file.is_file():
        return {"path": name, "present": False}
    data = file.read_bytes()
    return {"path": name, "present": True, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


extension = json.loads((ROOT / "extensions/ritemark/package.json").read_text())
webview = json.loads((ROOT / "extensions/ritemark/webview/package.json").read_text())
lock = json.loads((ROOT / "extensions/ritemark/webview/package-lock.json").read_text())
inventory = {
    "head": git("rev-parse", "HEAD"),
    "branch": git("branch", "--show-current"),
    "node": subprocess.check_output(["node", "-v"], cwd=ROOT).decode().strip(),
    "arch": subprocess.check_output(["node", "-p", "process.arch"], cwd=ROOT).decode().strip(),
    "submodule": git("submodule", "status"),
    "extension_version": extension["version"],
    "activation_events": extension.get("activationEvents", []),
    "sources": {
        "extension": source_inventory("extensions/ritemark/src/"),
        "webview": source_inventory("extensions/ritemark/webview/src/"),
    },
    "artifacts": [artifact(name) for name in [
        "extensions/ritemark/media/webview.js",
        "extensions/ritemark/media/webview.css",
        "extensions/ritemark/out/extension.js",
        "extensions/ritemark/media/pdf.worker.min.mjs",
    ]],
    "direct_webview_dependencies": webview.get("dependencies", {}),
    "echarts_named_lock_entries": [name for name in lock.get("packages", {}) if "echarts" in name.lower()],
    "patch_files": [name for name in tracked if name.startswith("patches/vscode/") and name.endswith(".patch")],
    "note": "Artifact sizes are working-file bytes at this source-only worktree, not packaged startup or memory measurements. Line counts are inventory, not quality scores.",
}

output = Path(__file__).with_name("baseline.json")
output.write_text(json.dumps(inventory, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({key: inventory[key] for key in ["head", "extension_version", "sources", "artifacts", "echarts_named_lock_entries"]}, indent=2))
