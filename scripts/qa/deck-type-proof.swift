// Sprint 172 (#940): what macOS says about a `.rtms` file once a bundle
// stamped by scripts/stamp-deck-document-type.sh is registered.
//
// Runs ONLY on an ephemeral GitHub macOS runner (.github/workflows/deck-type-proof.yml).
// Never run it on a person's Mac: the workflow registers a stand-in bundle as
// the owner of `.rtms` with lsregister first, and this script reads that claim.
//
// Usage: swift deck-type-proof.swift <file.rtms> <file.md> <out dir>
// Prints a plain report and writes the drawn icons as PNGs into <out dir>.

import AppKit
import Foundation
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 4 else {
    FileHandle.standardError.write("usage: deck-type-proof.swift <file.rtms> <file.md> <out dir>\n".data(using: .utf8)!)
    exit(2)
}
let deckFile = URL(fileURLWithPath: args[1])
let markdownFile = URL(fileURLWithPath: args[2])
let outDir = URL(fileURLWithPath: args[3], isDirectory: true)
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

var failures: [String] = []
func line(_ s: String) { print(s) }
func expect(_ ok: Bool, _ what: String) {
    line("  [\(ok ? "PASS" : "FAIL")] \(what)")
    if !ok { failures.append(what) }
}

func writePNG(_ image: NSImage, pixels: Int, to url: URL) {
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    ) else { return }
    rep.size = NSSize(width: pixels, height: pixels)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    image.draw(in: NSRect(x: 0, y: 0, width: pixels, height: pixels), from: .zero, operation: .copy, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()
    if let data = rep.representation(using: .png, properties: [:]) {
        try? data.write(to: url)
        line("  wrote \(url.lastPathComponent) (\(pixels) px)")
    }
}

line("macOS \(ProcessInfo.processInfo.operatingSystemVersionString)")
line("")
line("== The type for the extension rtms")
if let type = UTType(filenameExtension: "rtms") {
    line("  identifier: \(type.identifier)")
    line("  description: \(type.localizedDescription ?? "(none)")")
    line("  declared: \(type.isDeclared), dynamic: \(type.isDynamic)")
    line("  conforms to public.plain-text: \(type.conforms(to: .plainText))")
    expect(type.identifier == "ai.productory.ritemark.deck", "UTType for rtms is ai.productory.ritemark.deck")
    expect(type.localizedDescription == "Ritemark Deck", "its description is \"Ritemark Deck\"")
    expect(type.conforms(to: .plainText), "it conforms to public.plain-text")
} else {
    expect(false, "UTType(filenameExtension: \"rtms\") exists")
}

line("")
line("== The file \(deckFile.lastPathComponent)")
let values = try? deckFile.resourceValues(forKeys: [.localizedTypeDescriptionKey, .contentTypeKey])
let kind = values?.localizedTypeDescription ?? "(none)"
line("  Finder's kind (localizedTypeDescription): \(kind)")
line("  content type: \(values?.contentType?.identifier ?? "(none)")")
expect(kind == "Ritemark Deck", "the file's kind is \"Ritemark Deck\"")

if let app = NSWorkspace.shared.urlForApplication(toOpen: deckFile) {
    let id = Bundle(url: app)?.bundleIdentifier ?? "(unknown)"
    line("  opens with: \(app.path) (\(id))")
    expect(id == "ai.productory.ritemark", "a double-click opens Ritemark (ai.productory.ritemark)")
    // The badge's Assets.car must not change the app's own icon.
    writePNG(NSWorkspace.shared.icon(forFile: app.path), pixels: 256, to: outDir.appendingPathComponent("app-icon-256.png"))
} else {
    expect(false, "some app opens the file")
}

line("")
line("== The drawn icons")
let deckIcon = NSWorkspace.shared.icon(forFile: deckFile.path)
writePNG(deckIcon, pixels: 512, to: outDir.appendingPathComponent("rtms-icon-512.png"))
writePNG(deckIcon, pixels: 128, to: outDir.appendingPathComponent("rtms-icon-128.png"))
writePNG(deckIcon, pixels: 64, to: outDir.appendingPathComponent("rtms-icon-64.png"))
writePNG(deckIcon, pixels: 32, to: outDir.appendingPathComponent("rtms-icon-32.png"))
if let type = UTType("ai.productory.ritemark.deck") {
    writePNG(NSWorkspace.shared.icon(for: type), pixels: 512, to: outDir.appendingPathComponent("uti-icon-512.png"))
}
let markdownIcon = NSWorkspace.shared.icon(forFile: markdownFile.path)
writePNG(markdownIcon, pixels: 512, to: outDir.appendingPathComponent("md-icon-512.png"))
let plainIcon = NSWorkspace.shared.icon(for: .plainText)
writePNG(plainIcon, pixels: 512, to: outDir.appendingPathComponent("plain-text-icon-512.png"))
line("  (rtms-icon-*.png should be the system's page with the deck badge and DECK; compare plain-text-icon-512.png)")

line("")
if failures.isEmpty {
    line("RESULT: all checks passed")
} else {
    line("RESULT: \(failures.count) check(s) failed:")
    failures.forEach { line("  - \($0)") }
}
exit(failures.isEmpty ? 0 : 1)
