"""Validate the built proof bundle and the Swift class named in its plist."""
import plistlib
import subprocess
import sys
from pathlib import Path

bundle, kind = Path(sys.argv[1]), sys.argv[2]
name = f"RitemarkDeck{kind}"
class_name = {"Thumbnail": "ThumbnailProvider", "Preview": "PreviewViewController"}[kind]
contents = bundle / "Contents"
with (contents / "Info.plist").open("rb") as stream:
    info = plistlib.load(stream)
extension = info["NSExtension"]
executable = contents / "MacOS" / info["CFBundleExecutable"]
principal = extension["NSExtensionPrincipalClass"]
checks = {
    "CFBundlePackageType": (info["CFBundlePackageType"], "XPC!"),
    "CFBundleIdentifier": (info["CFBundleIdentifier"], f"ai.productory.ritemark.deck-{kind.lower()}"),
    "NSExtensionPointIdentifier": (extension["NSExtensionPointIdentifier"], f"com.apple.quicklook.{kind.lower()}"),
    "NSExtensionPrincipalClass": (principal, f"{name}.{class_name}"),
    "QLSupportedContentTypes": (extension["NSExtensionAttributes"]["QLSupportedContentTypes"], ["ai.productory.ritemark.deck"]),
    "CFBundleExecutable": (info["CFBundleExecutable"], name),
    "Executable exists": (executable.is_file(), True),
}
failed = False
for key, (actual, expected) in checks.items():
    ok = actual == expected
    print(f"{'PASS' if ok else 'FAIL'} {key} = {actual!r} (expected {expected!r})")
    failed |= not ok
if failed:
    sys.exit(1)

# Objective-C runtime name of the module-qualified Swift class.
symbol = f"_OBJC_CLASS_$__TtC{len(name)}{name}{len(class_name)}{class_name}"

for arch in ("arm64", "x86_64"):
    symbols = subprocess.check_output(["xcrun", "nm", "-arch", arch, str(executable)], text=True)
    found = any(line.endswith(f" {symbol}") and len(line.split()) == 3 for line in symbols.splitlines())
    print(f"{'PASS' if found else 'FAIL'} {arch} defines {symbol}")
    failed |= not found
sys.exit(int(failed))
