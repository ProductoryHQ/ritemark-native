"""Validate the built proof bundle and the Swift class named in its plist."""
import plistlib
import subprocess
import sys
from pathlib import Path

bundle, kind = Path(sys.argv[1]), sys.argv[2]
name = f"RitemarkDeck{kind}"
class_name = {"Thumbnail": "ThumbnailProvider", "Preview": "PreviewProvider"}[kind]
contents = bundle / "Contents"
with (contents / "Info.plist").open("rb") as stream:
    info = plistlib.load(stream)
extension = info["NSExtension"]
attrs = extension["NSExtensionAttributes"]
with (bundle.parent / f"{name}.entitlements").open("rb") as stream:
    entitlements = plistlib.load(stream)
executable = contents / "MacOS" / info["CFBundleExecutable"]
principal = extension["NSExtensionPrincipalClass"]
checks = {
    "CFBundlePackageType": (info["CFBundlePackageType"], "XPC!"),
    "CFBundleIdentifier": (info["CFBundleIdentifier"], f"ai.productory.ritemark.deck-{kind.lower()}"),
    "NSExtensionPointIdentifier": (extension["NSExtensionPointIdentifier"], f"com.apple.quicklook.{kind.lower()}"),
    "NSExtensionPrincipalClass": (principal, f"{name}.{class_name}"),
    "QLSupportedContentTypes": (extension["NSExtensionAttributes"]["QLSupportedContentTypes"], ["ai.productory.ritemark.deck"]),
    "CFBundleExecutable": (info["CFBundleExecutable"], name),
    "Minimum macOS": (info["LSMinimumSystemVersion"], "12.0"),
    "Host ID": (info["RitemarkHostBundleIdentifier"], "ai.productory.ritemark"),
    "Searchable items": (attrs["QLSupportsSearchableItems"], False),
    "Entitlements": (entitlements, {
        "com.apple.security.app-sandbox": True,
        "com.apple.security.files.user-selected.read-only": True,
        "com.apple.security.temporary-exception.files.home-relative-path.read-only": ["/"],
    }),
    "Executable exists": (executable.is_file(), True),
}
if kind == "Preview":
    checks["Data-based preview"] = (attrs["QLIsDataBasedPreview"], True)
else:
    checks["Thumbnail minimum dimension"] = (attrs["QLThumbnailMinimumDimension"], 0)
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
    build = subprocess.check_output(["xcrun", "vtool", "-arch", arch, "-show-build", str(executable)], text=True)
    targets_macos12 = "platform MACOS" in build and ("minos 12.0\n" in build or "minos 12.0.0\n" in build)
    print(f"{'PASS' if targets_macos12 else 'FAIL'} {arch} deployment target\n{build}")
    failed |= not targets_macos12
    libraries = subprocess.check_output(["xcrun", "otool", "-arch", arch, "-L", str(executable)], text=True)
    failed |= "WebKit" in libraries
    symbols = subprocess.check_output(["xcrun", "nm", "-arch", arch, str(executable)], text=True)
    found = any(line.endswith(f" {symbol}") and len(line.split()) == 3 for line in symbols.splitlines())
    print(f"{'PASS' if found else 'FAIL'} {arch} defines {symbol}")
    failed |= not found
sys.exit(int(failed))
