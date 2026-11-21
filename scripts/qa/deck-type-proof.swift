// Sprint 172 (#940): what macOS says about a `.rtms` file once a bundle
// stamped by scripts/stamp-deck-document-type.sh is registered.
//
// Runs ONLY on an ephemeral GitHub macOS runner (.github/workflows/deck-type-proof.yml).
// Never run it on a person's Mac: the workflow registers a stand-in bundle as
// the owner of `.rtms` with lsregister first, and this script reads that claim.
//
// Usage: swift deck-type-proof.swift <file.rtms> <file.md> <out dir> <unstamped twin .app>
// Prints a plain report, writes the drawn icons as PNGs into <out dir>, and
// exits 1 if any check fails. The twin is the same stand-in without the stamp:
// the stamped app's own icon must look the same as the twin's.

import AppKit
import Foundation
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 5 else {
    FileHandle.standardError.write("usage: deck-type-proof.swift <file.rtms> <file.md> <out dir> <unstamped twin .app>\n".data(using: .utf8)!)
    exit(2)
}
let deckFile = URL(fileURLWithPath: args[1])
let markdownFile = URL(fileURLWithPath: args[2])
let outDir = URL(fileURLWithPath: args[3], isDirectory: true)
let twinApp = URL(fileURLWithPath: args[4])
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

var failures: [String] = []
func line(_ s: String) { print(s) }
func expect(_ ok: Bool, _ what: String) {
    line("  [\(ok ? "PASS" : "FAIL")] \(what)")
    if !ok { failures.append(what) }
}

/// Draws an image into an RGBA bitmap of the given pixel size.
func bitmap(_ image: NSImage, pixels: Int) -> NSBitmapImageRep? {
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    ) else { return nil }
    rep.size = NSSize(width: pixels, height: pixels)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    image.draw(in: NSRect(x: 0, y: 0, width: pixels, height: pixels), from: .zero, operation: .copy, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()
    return rep
}

@discardableResult
func writePNG(_ image: NSImage, pixels: Int, name: String) -> NSBitmapImageRep? {
    guard let rep = bitmap(image, pixels: pixels) else { return nil }
    if let data = rep.representation(using: .png, properties: [:]) {
        try? data.write(to: outDir.appendingPathComponent(name))
        line("  wrote \(name) (\(pixels) px)")
    }
    return rep
}

/// RGBA bytes of a bitmap, row by row.
func rgba(_ rep: NSBitmapImageRep) -> [UInt8] {
    var out: [UInt8] = []
    out.reserveCapacity(rep.pixelsWide * rep.pixelsHigh * 4)
    for y in 0..<rep.pixelsHigh {
        for x in 0..<rep.pixelsWide {
            var p = [Int](repeating: 0, count: 4)
            rep.getPixel(&p, atX: x, y: y)
            out.append(contentsOf: p.map { UInt8(clamping: $0) })
        }
    }
    return out
}

/// How many pixels are close to the badge's colour, #4338ca.
func badgePixels(_ rep: NSBitmapImageRep) -> Int {
    let px = rgba(rep)
    var n = 0
    for i in stride(from: 0, to: px.count, by: 4) where px[i + 3] > 200 {
        let dr = Int(px[i]) - 0x43, dg = Int(px[i + 1]) - 0x38, db = Int(px[i + 2]) - 0xca
        if dr * dr + dg * dg + db * db < 40 * 40 { n += 1 }
    }
    return n
}

/// Mean absolute difference of two same-sized bitmaps, 0–255.
func meanDifference(_ a: NSBitmapImageRep, _ b: NSBitmapImageRep) -> Double {
    let pa = rgba(a), pb = rgba(b)
    guard pa.count == pb.count, !pa.isEmpty else { return 255 }
    var sum = 0
    for i in 0..<pa.count { sum += abs(Int(pa[i]) - Int(pb[i])) }
    return Double(sum) / Double(pa.count)
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

var stampedApp: URL?
if let app = NSWorkspace.shared.urlForApplication(toOpen: deckFile) {
    let id = Bundle(url: app)?.bundleIdentifier ?? "(unknown)"
    line("  opens with: \(app.path) (\(id))")
    expect(id == "ai.productory.ritemark", "a double-click opens Ritemark (ai.productory.ritemark)")
    stampedApp = app
} else {
    expect(false, "some app opens the file")
}

line("")
line("== The drawn icons")
let deckIcon = NSWorkspace.shared.icon(forFile: deckFile.path)
let deck512 = writePNG(deckIcon, pixels: 512, name: "rtms-icon-512.png")
writePNG(deckIcon, pixels: 128, name: "rtms-icon-128.png")
writePNG(deckIcon, pixels: 64, name: "rtms-icon-64.png")
let deck32 = writePNG(deckIcon, pixels: 32, name: "rtms-icon-32.png")
if let type = UTType("ai.productory.ritemark.deck") {
    writePNG(NSWorkspace.shared.icon(for: type), pixels: 512, name: "uti-icon-512.png")
}
writePNG(NSWorkspace.shared.icon(forFile: markdownFile.path), pixels: 512, name: "md-icon-512.png")
writePNG(NSWorkspace.shared.icon(for: .plainText), pixels: 512, name: "plain-text-icon-512.png")
let badge512 = deck512.map(badgePixels) ?? 0
let badge32 = deck32.map(badgePixels) ?? 0
line("  badge-coloured (#4338ca) pixels: \(badge512) at 512 px, \(badge32) at 32 px")
expect(badge512 > 1000, "the deck's page carries the badge at 512 px")
expect(badge32 > 5, "the deck's page carries the badge at 32 px")

line("")
line("== The app's own icon (the badge's Assets.car must not change it)")
if let app = stampedApp,
   let stamped = writePNG(NSWorkspace.shared.icon(forFile: app.path), pixels: 256, name: "app-icon-256.png"),
   let twin = writePNG(NSWorkspace.shared.icon(forFile: twinApp.path), pixels: 256, name: "app-icon-unstamped-256.png"),
   let generic = writePNG(NSWorkspace.shared.icon(for: .applicationBundle), pixels: 256, name: "app-icon-generic-256.png") {
    let sameAsTwin = meanDifference(stamped, twin)
    let fromGeneric = meanDifference(stamped, generic)
    line("  mean difference from the unstamped twin: \(String(format: "%.2f", sameAsTwin)); from the generic app icon: \(String(format: "%.2f", fromGeneric))")
    expect(fromGeneric > 10, "the stamped app shows its own icon, not the generic one")
    expect(sameAsTwin < 2, "the stamped app's icon looks as the unstamped twin's")
} else {
    expect(false, "the app icons could be drawn")
}

line("")
if failures.isEmpty {
    line("RESULT: all checks passed")
} else {
    line("RESULT: \(failures.count) check(s) failed:")
    failures.forEach { line("  - \($0)") }
}
exit(failures.isEmpty ? 0 : 1)
