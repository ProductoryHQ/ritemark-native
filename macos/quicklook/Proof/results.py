"""Summarize registration and attribute Quick Look observations to each runner step."""
import platform
import plistlib
import re
import sys
from pathlib import Path

proof, variant = Path(sys.argv[1]), sys.argv[2]
registration = proof / "registration"
stages = {
    "01-preflight": "1 · Bundle and signature checks",
    "02-install": "2 · Install and lsregister",
    "03-launch": "3 · Launch and quit",
    "04-add": "4 · PlugInKit add",
    "05-elect": "5 · PlugInKit use",
    "06-reset": "6 · Quick Look reset and cache reset",
}
kinds = ("thumbnail", "preview")
fixtures = ("theme-and-picture.rtms", "skipped-first.rtms", "missing-theme.rtms",
            "missing-picture.rtms", "no-slides.rtms", "plain.md")


def read(path):
    return path.read_text(errors="replace") if path.is_file() else ""


def rows(path):
    return {row[0]: row[1:] for line in read(path).splitlines() if len(row := line.split("\t")) > 1}


def answer(value):
    return {True: "Yes", False: "No", None: "Inconclusive"}[value]


def default_election(kind):
    path = registration / f"{kind}.appexpt"
    if path.is_file():
        return plistlib.loads(path.read_bytes()).get(f"com.apple.quicklook.{kind}", {}).get("EXDefaultUserElection")
    return None


def plugin_state(stage, kind):
    path = registration / f"{stage}.{kind}.txt"
    if not path.is_file():
        return None, None, "Step not reached"
    identifier = f"ai.productory.ritemark.deck-{kind}"
    match = re.search(rf"^\s*([+!\-= ?]?)\s*{re.escape(identifier)}\(", read(path), re.M)
    if not match:
        if "(no matches)" in read(path):
            return False, False, "Absent"
        return None, None, "See raw listing"
    election = match[1].strip()
    if election in ("?", "="):
        return True, None, f"PlugInKit `{election}`"
    if election:
        return True, election in ("+", "!"), f"PlugInKit `{election}`"
    return True, default_election(kind), "Default election"


def asset(log, mode, key):
    matches = re.findall(rf"{mode} {re.escape(key)} (yes|no)\b", log)
    return answer(matches[-1] == "yes" if matches else None)


def thumbnail_answers(directory):
    generator = rows(directory / "generator.tsv")
    cli = rows(directory / "qlmanage.tsv")
    ocr = rows(directory / "qlmanage-ocr.tsv")
    log = read(directory / "generator-log.txt")
    cli_log = read(directory / "qlmanage-log.txt")

    def timing(name):
        row = generator.get(name)
        return f"{row[0]} ms ({row[1]})" if row else "Unavailable"

    invoked = "thumbnail started timed-01.rtms" in log
    drawn = "thumbnail drawn timed-01.rtms" in log
    empty = "thumbnail empty no-slides.rtms noSlides" in log
    fallback = "Inconclusive"
    if empty and "no-slides.rtms" in generator:
        _, kind, contents = generator["no-slides.rtms"]
        generated = directory / "generator/no-slides.rtms.png"
        icon = directory / "icons/no-slides.rtms.png"
        if kind == "icon" or (generated.is_file() and icon.is_file() and generated.read_bytes() == icon.read_bytes()):
            fallback = "Deck icon"
        elif "fallback text marker" in contents.casefold():
            fallback = "Text picture"
        elif kind == "none":
            fallback = "No representation"
        else:
            fallback = f"{kind}. Inspect the PNG"
    cli_empty = "thumbnail empty no-slides.rtms noSlides" in cli_log
    cli_text = "fallback text marker" in " ".join(ocr.get("no-slides.rtms.png", [])).casefold()
    generator_timeouts = [name for name, row in generator.items() if row[1] == "timeout"]
    cli_timeouts = [name for name, row in cli.items() if row[0] == "142"]
    lines = [
        f"- WebKit returned a thumbnail for the first deck? {answer(drawn if invoked else None)}.",
        f"- First deck **{timing('timed-01.rtms')}**, tenth deck **{timing('timed-10.rtms')}**. Use the extension log to distinguish the system fallback.",
        f"- Thumbnail read the sidecar theme? {asset(log, 'thumbnail', 'theme theme-and-picture.rtms')}.",
        f"- Thumbnail read the sidecar picture? {asset(log, 'thumbnail', 'asset theme-and-picture.rtms deck:shapes.png')}.",
        f"- Extension answered nothing for the empty deck? {answer(True if empty else None)}.",
        f"- Best representation after the empty reply. **{fallback}**.",
        f"- qlmanage showed a text picture after the extension's empty reply? {answer(cli_text if cli_empty and 'no-slides.rtms.png' in ocr else None)}.",
    ]
    for tool, timeouts, tool_log in (("Generator (12 s)", generator_timeouts, log),
                                    ("qlmanage (15 s)", cli_timeouts, cli_log)):
        entered = [name for name in timeouts if f"thumbnail started {name}" in tool_log]
        replied = [name for name in entered if re.search(rf"thumbnail (?:drawn|timeout|empty) {re.escape(name)}(?:\s|$)", tool_log)]
        lines.append(f"- {tool} timeouts: {', '.join(timeouts) or 'none'}. Extension entry: {', '.join(entered) or 'none observed'}. Extension reply: {', '.join(replied) or 'none observed'}.")
    lines += ["", "| Fixture | Generator | qlmanage exit | qlmanage OCR |", "| --- | --- | --- | --- |"]
    for name in fixtures:
        contents = " ".join(ocr.get(name + ".png", [])).replace("|", "/")
        lines.append(f"| {name} | {timing(name)} | {cli.get(name, ['Unavailable'])[0]} | {contents} |")
    return lines


def preview_answers(directory):
    log = read(directory / "extension-log.txt")
    ocr = rows(directory / "preview-ocr.tsv")
    preview = re.search(r"preview drawn skipped-first\.rtms ([^\r\n]+)", log)
    slides = preview[1].strip() if preview else ""
    plain = "system markdown marker" in " ".join(ocr.get("plain.md.png", [])).casefold()
    invalid_text = "system markdown marker" in " ".join(ocr.get("invalid-deck.rtms.png", [])).casefold()
    invalid_started = "preview started invalid-deck.rtms" in log
    invalid_result = re.search(r"preview (?:drawn|failed) invalid-deck\.rtms ([^\r\n]+)", log)
    return [
        f"- Preview read the sidecar theme? {asset(log, 'preview', 'theme theme-and-picture.rtms')}.",
        f"- Preview read the sidecar picture? {asset(log, 'preview', 'asset theme-and-picture.rtms deck:shapes.png')}.",
        f"- Preview showed the two visible slides in order? {answer(slides == 'First Visible | Second Visible' if preview else None)}. DOM text: {slides or 'unavailable'}.",
        f"- Invalid deck reached the preview extension? {answer(True if invalid_started else None)}. Extension result: {invalid_result[0] if invalid_result else 'unavailable'}.",
        f"- Invalid deck text visible in the panel? {answer(invalid_text if invalid_started and 'invalid-deck.rtms.png' in ocr else None)}.",
        f"- System Markdown preview text visible? {answer(True if plain else None)}.",
    ]


lines = [
    f"# Quick Look proof on macOS {platform.mac_ver()[0]} ({platform.machine()}, {variant})",
    "", "## Registration", "",
    "| After step | Thumbnail listed | Thumbnail enabled | Preview listed | Preview enabled |",
    "| --- | --- | --- | --- | --- |",
]
first = {}
for stage, title in stages.items():
    columns = []
    for kind in kinds:
        listed, enabled, election = plugin_state(stage, kind)
        columns.extend((answer(listed), f"{answer(enabled)} ({election})"))
        if listed:
            first.setdefault(kind, stage)
    lines.append(f"| {title} | {' | '.join(columns)} |")
lines += ["", "An unmarked PlugInKit entry uses the extension point’s published default when available. The probe logs show actual invocation.", ""]
for kind in kinds:
    stage = first.get(kind)
    lines.append(f"- {kind.title()} first listed after {stages[stage] if stage else 'no observed step'}.")
    listed, enabled, election = plugin_state("04-add", kind)
    path = proof / (stage or "") / kind / ("generator-log.txt" if kind == "thumbnail" else "extension-log.txt")
    invoked = stage in ("01-preflight", "02-install", "03-launch", "04-add") and f"{kind} started " in read(path)
    lines.append(f"- {kind.title()} enabled before forced election (after step 4): {answer(enabled)} ({election}).")
    observed = True if invoked else False if listed and enabled is False else None
    lines.append(f"- {kind.title()} used before forced election: {answer(observed)} (after {stages[stage] if invoked else 'step 4'}).")

for stage, title in stages.items():
    for kind in kinds:
        directory = proof / stage / kind
        if directory.is_dir():
            lines += ["", f"## {kind.title()} probes after {title}", ""]
            lines += thumbnail_answers(directory) if kind == "thumbnail" else preview_answers(directory)
            if not plugin_state(stage, kind)[0]:
                lines += ["", "PlugInKit did not list the extension at this step. Any returned images may be system fallbacks."]
lines += ["", "The PNGs, per-step command output, listings, and unified logs accompany the summary.", ""]
(proof / "results.md").write_text("\n".join(lines))
