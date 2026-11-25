"""Summarize one round 3 probe and preserve the source evidence."""
import platform
import re
import sys
from pathlib import Path

proof = Path(sys.argv[1])
variant = sys.argv[2]
extension = "RitemarkDeckPreview" if variant == "D" else "RitemarkDeckThumbnail"


def read(name):
    path = proof / name
    return path.read_text(errors="replace").strip() if path.is_file() else ""


def evidence(lines):
    if lines:
        print("\n```text\n" + "\n".join(lines) + "\n```")


system = read("system-log.txt").splitlines()
extension_lines = [line for line in system if f" {extension}:" in line]
lifecycle = [line for line in extension_lines if "ai.productory.ritemark.quicklook:" in line]
launch = [line for line in extension_lines if "WebProcessProxy::didFinishLaunching" in line]
pids = sorted({pid for line in launch for pid in re.findall(r"\[PID=([1-9]\d*)\]", line)}, key=int)
launch_failed = any("web process failed to launch" in line for line in launch)
terminations = [line for line in extension_lines if "WebProcessProxy::processDidTerminateOrFailedToLaunch" in line]
crashed_pids = sorted({
    pid for line in terminations if "reason=Crash" in line
    for pid in re.findall(r"\[PID=([1-9]\d*)\]", line)
}, key=int)
process_names = re.compile(r"RitemarkDeck|WebKi(?:t)?|WebContent|WebProcess", re.I)
denials = [
    line for line in read("sandbox-log.txt").splitlines()
    if process_names.search(line) and ("Sandbox:" in line or "deny(" in line)
]

with (proof / "results.md").open("w") as sys.stdout:
    print(f"# Quick Look proof on macOS {platform.mac_ver()[0]} ({platform.machine()}, {variant})\n")
    if pids:
        print("WebContent launched with PID " + ", ".join(pids) + ".")
    if launch_failed:
        print("WebKit reported a WebContent launch failure (PID 0).")
    if crashed_pids:
        print("WebKit reported a crash after launch for PID " + ", ".join(crashed_pids) + ".")
    if not (pids or launch_failed):
        print("WebContent launch inconclusive. No positive PID or explicit launch failure was logged.")
    evidence([line for line in extension_lines if line in launch or line in terminations])
    if (proof / "system-log.failed").exists():
        print("\nSystem log collection failed. See system-log.txt.")

    print("\n## Snapshot and time")
    pngs = sorted((proof / "png").glob("*.png"))
    if pngs:
        for png in pngs:
            print(f"- [{png.name}](png/{png.name})")
    else:
        print("\nNo PNG was captured.")
    if variant == "D":
        print("\npreview-snapshot.png is the WebKit snapshot. preview.png is the Quick Look window capture at 12 s.")
        if not (proof / "png/preview-snapshot.png").exists():
            print("No WebKit snapshot PNG was recovered. See the lifecycle log and snapshot-copy.stderr if present.")
        print("The extension reply below records render and snapshot elapsed time.")
        evidence(read("preview-ocr.tsv").splitlines())
    else:
        print("\nQuick Look generator result and elapsed milliseconds. An icon is a fallback.")
        evidence(read("probe.tsv").splitlines())
    print("\n### Extension lifecycle")
    evidence(lifecycle)
    if not lifecycle:
        print("\nNo extension lifecycle entries were observed.")

    print("\n## Sandbox denials")
    if (proof / "sandbox-log.failed").exists():
        print("\nCollection failed. See sandbox-log.txt.")
    elif not denials:
        print("\nNo matching lines in the probe window. See sandbox-log.txt for the complete query.")
    evidence(denials)

    if variant == "B":
        print("\n## Network")
        # Unified logging can show failed attempts. nettop can only establish
        # that a connection was visible at one of its sample times.
        attempts = [
            line for line in system + denials
            if re.search(r"network-outbound|\bnw_connection_start\b|\bnw_flow_connected\b", line, re.I)
            and process_names.search(line)
        ]
        samples = []
        relevant = False
        for line in read("nettop.csv").splitlines():
            source = line.split(",", 1)[0]
            if "<->" in source:
                if relevant:
                    samples.append(line)
            else:
                relevant = bool(process_names.search(source))
                if relevant:
                    samples.append(line)
        connections = any("<->" in line for line in samples)
        if attempts or connections:
            print("\nNetwork activity observed for the extension or a WebKit process in the probe window. WebKit rows can include unrelated processes.")
        elif (proof / "nettop.failed").exists() or not read("nettop.csv"):
            print("\nNetwork activity inconclusive. nettop did not collect usable samples.")
        else:
            print("\nNo matching attempts in the logs or connections in the samples. Brief attempts between samples may be missed.")
        evidence(list(dict.fromkeys(attempts + samples)))
        print("\nSee nettop.csv and nettop.stderr for raw samples.")
