"""Summarize observations from the system probes and extension process."""
import platform
import re
import sys
from pathlib import Path

proof, variant = Path(sys.argv[1]), sys.argv[2]


def read(name):
    return (proof / name).read_text(errors="replace")


def rows(name):
    return {row[0]: row[1:] for line in read(name).splitlines() if len(row := line.split("\t")) > 1}


def answer(value):
    return {True: "Yes", False: "No", None: "Inconclusive"}[value]


def asset(mode, key):
    matches = re.findall(rf"{mode} {re.escape(key)} (yes|no)\b", extension_log)
    return answer(matches[-1] == "yes" if matches else None)


def timing(name):
    row = generator.get(name)
    return f"{row[0]} ms ({row[1]})" if row else "Unavailable"


plugins = read("pluginkit-thumbnail.txt")
generator_log = read("generator-log.txt")
extension_log = read("extension-log.txt")
generator = rows("generator.tsv")
preview_ocr = rows("preview-ocr.tsv")
qlmanage_ocr = rows("qlmanage-ocr.tsv")

listed = next((line.strip() for line in plugins.splitlines() if "ai.productory.ritemark.deck-thumbnail" in line), "")
drawn = "thumbnail drawn timed-01.rtms" in generator_log
invoked = bool(re.search(r"thumbnail (?:theme|timeout|empty|drawn) timed-\d+\.rtms", generator_log))
used = True if invoked else False if listed.startswith("-") else None
preview = re.search(r"preview drawn skipped-first\.rtms ([^\r\n]+)", extension_log)
preview_slides = preview[1].strip() if preview else ""
plain_text = " ".join(preview_ocr.get("plain.md.png", [])).casefold()
plain_fallback = True if "system markdown marker" in plain_text else None

fallback_row = generator.get("no-slides.rtms", ["", "none", ""])
fallback_kind, fallback_ocr = fallback_row[1:3]
observed_empty = "thumbnail empty no-slides.rtms noSlides" in generator_log
fallback = "Inconclusive"
if observed_empty:
    generated = proof / "generator" / "no-slides.rtms.png"
    icon = proof / "icons" / "no-slides.rtms.png"
    matches_icon = generated.is_file() and icon.is_file() and generated.read_bytes() == icon.read_bytes()
    if fallback_kind == "icon" or matches_icon:
        fallback = "Deck icon"
    elif "fallback text marker" in fallback_ocr.casefold():
        fallback = "Text picture"
    elif fallback_kind == "none":
        fallback = "No representation"
    else:
        fallback = f"{fallback_kind}. Inspect the PNG"

lines = [
    f"# Quick Look proof on macOS {platform.mac_ver()[0]} ({platform.machine()}, {variant})",
    "",
    f"- Thumbnail listed by PlugInKit? {answer(bool(listed))}. Listing: {listed or 'absent'}.",
    f"- Thumbnail used by default? {answer(used)}.",
    f"- WebKit returned a thumbnail for the first deck? {answer(drawn if invoked else None)}.",
    f"- First deck **{timing('timed-01.rtms')}**, tenth deck **{timing('timed-10.rtms')}**.",
    f"- Thumbnail read the sidecar theme? {asset('thumbnail', 'theme theme-and-picture.rtms')}.",
    f"- Thumbnail read the sidecar picture? {asset('thumbnail', 'asset theme-and-picture.rtms deck:shapes.png')}.",
    f"- Preview read the sidecar theme? {asset('preview', 'theme theme-and-picture.rtms')}.",
    f"- Preview read the sidecar picture? {asset('preview', 'asset theme-and-picture.rtms deck:shapes.png')}.",
    f"- Extension answered nothing for the empty deck? {answer(True if observed_empty else None)}.",
    f"- Best representation after the empty reply. **{fallback}**.",
    f"- qlmanage showed a text picture for the empty deck? {answer(True if any('fallback text marker' in word.casefold() for word in qlmanage_ocr.get('no-slides.rtms.png', [])) else None)}.",
    f"- Preview showed the two visible slides in order? {answer(preview_slides == 'First Visible | Second Visible' if preview else None)}. DOM text: {preview_slides or 'unavailable'}.",
    f"- System Markdown preview text visible? {answer(plain_fallback)}.",
    "",
    "## Fixture images",
    "",
    "| Fixture | Generator | qlmanage PNG |",
    "| --- | --- | --- |",
]
for name in ("theme-and-picture.rtms", "skipped-first.rtms", "missing-theme.rtms",
             "missing-picture.rtms", "no-slides.rtms", "plain.md"):
    png = name + ".png"
    cli = answer((proof / "qlmanage" / png).is_file())
    text = " ".join(qlmanage_ocr.get(png, [])).replace("|", "/")
    lines.append(f"| {name} | {timing(name)} | {cli} {text} |")

lines += ["", "The PNGs and raw logs accompany the summary.", ""]
(proof / "results.md").write_text("\n".join(lines))
