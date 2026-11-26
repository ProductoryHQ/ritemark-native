import AppKit
import QuickLookThumbnailing
import Vision

enum ProbeError: Error {
    case timeout, absentRepresentation, wrongRepresentation, imageMismatch, missingText
}

func recognizedText(_ url: URL, separator: String = " ") throws -> String {
    let request = VNRecognizeTextRequest()
    try VNImageRequestHandler(url: url).perform([request])
    return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: separator)
}

private let settingsBundleID = "com.apple.systempreferences"

func settingsWindows() -> [[String: Any]] {
    let owners = NSRunningApplication.runningApplications(withBundleIdentifier: settingsBundleID)
        .map(\.processIdentifier)
    let windows = CGWindowListCopyWindowInfo([.excludeDesktopElements], kCGNullWindowID)
        as? [[String: Any]] ?? []
    fputs("Settings PIDs: \(owners); WindowServer entries: \(windows.count)\n", stderr)
    return windows.filter { window in
        let pid = window[kCGWindowOwnerPID as String] as? pid_t
        let name = window[kCGWindowOwnerName as String] as? String
        guard pid.map(owners.contains) == true || name == "System Settings" || name == "System Preferences" else {
            return false
        }
        fputs("Settings window: \(window)\n", stderr)
        let bounds = window[kCGWindowBounds as String] as? [String: Any]
        return window[kCGWindowLayer as String] as? Int == 0
            && (bounds?["Width"] as? Double ?? 0) >= 400
            && (bounds?["Height"] as? Double ?? 0) >= 300
    }
}

func settingsWindowID() -> Int? {
    let windows = settingsWindows()
    let window = windows.first { $0[kCGWindowIsOnscreen as String] as? Bool == true } ?? windows.first
    return window?[kCGWindowNumber as String] as? Int
}

func settingsAttribute<T>(_ element: AXUIElement, _ attribute: String) -> T? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, attribute as CFString, &value) == .success else { return nil }
    return value as? T
}

func settingsElement(in element: AXUIElement, matching predicate: (AXUIElement) -> Bool) -> AXUIElement? {
    if predicate(element) { return element }
    let children: [AXUIElement] = settingsAttribute(element, kAXChildrenAttribute) ?? []
    for child in children.reversed() {
        if let found = settingsElement(in: child, matching: predicate) { return found }
    }
    return nil
}

func selectSettingsCategory(in window: AXUIElement, root: AXUIElement) throws {
    func control(in element: AXUIElement, label: String, roles: [String]) -> AXUIElement? {
        settingsElement(in: element) { item in
            let role: String = settingsAttribute(item, kAXRoleAttribute) ?? ""
            return roles.contains(role) && [kAXTitleAttribute, kAXDescriptionAttribute, kAXValueAttribute].contains {
                settingsAttribute(item, $0) as String? == label
            }
        }
    }

    let categoryRoles = [kAXButtonRole, kAXMenuItemRole, kAXRadioButtonRole]
    var item = control(in: window, label: "By Category", roles: categoryRoles)
    if item == nil, let popup = control(in: window, label: "By App", roles: [kAXPopUpButtonRole]),
       AXUIElementPerformAction(popup, kAXPressAction as CFString) == .success {
        item = control(in: root, label: "By Category", roles: [kAXMenuItemRole])
        if item == nil {
            _ = AXUIElementPerformAction(popup, kAXCancelAction as CFString)
        }
    }
    guard let item, AXUIElementPerformAction(item, kAXPressAction as CFString) == .success else {
        throw ProbeError.absentRepresentation
    }
}

func settingsAction(_ action: String) throws {
    if action != "--settings-scroll" {
        guard AXIsProcessTrusted() else {
            fputs("Accessibility permission unavailable for \(action).\n", stderr)
            exit(2)
        }
        guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: settingsBundleID).first else {
            throw ProbeError.absentRepresentation
        }
        let root = AXUIElementCreateApplication(app.processIdentifier)
        let window: AXUIElement = settingsAttribute(root, kAXFocusedWindowAttribute) ?? root
        if action == "--settings-category" {
            try selectSettingsCategory(in: window, root: root)
        } else {
            guard let area = settingsElement(in: window, matching: { element in
                let role: String? = settingsAttribute(element, kAXRoleAttribute)
                let vertical: AXUIElement? = settingsAttribute(element, kAXVerticalScrollBarAttribute)
                return role == kAXScrollAreaRole && vertical != nil
            }), let bar: AXUIElement = settingsAttribute(area, kAXVerticalScrollBarAttribute),
                  AXUIElementSetAttributeValue(bar, kAXValueAttribute as CFString,
                                               NSNumber(value: action == "--settings-scroll-end" ? 1 : 0)) == .success
            else { throw ProbeError.absentRepresentation }
        }
        return
    }
    guard CGPreflightPostEventAccess() else {
        fputs("Event posting permission unavailable for scroll.\n", stderr)
        exit(2)
    }
    let windows = settingsWindows()
    guard let window = windows.first(where: { $0[kCGWindowIsOnscreen as String] as? Bool == true }),
          let bounds = window[kCGWindowBounds as String] as? [String: Any],
          let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary),
          let event = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 1,
                              wheel1: -275, wheel2: 0, wheel3: 0) else {
        throw ProbeError.absentRepresentation
    }
    // WindowServer bounds and the Quartz cursor both use global display points.
    #if arch(x86_64)
    let point = CGPoint(x: rect.minX + rect.width * 0.7, y: rect.minY + rect.height * 0.6)
    #else
    let point = CGPoint(x: rect.minX + rect.width * 0.75, y: rect.midY)
    #endif
    fputs("Settings scroll: global point \(point), window bounds \(rect)\n", stderr)
    #if arch(x86_64)
    // Align the cursor with the event location so the wheel targets the content pane.
    guard CGWarpMouseCursorPosition(point) == .success else {
        fputs("Could not move the cursor to the Settings scroll point.\n", stderr)
        throw ProbeError.absentRepresentation
    }
    #endif
    event.location = point
    event.post(tap: .cghidEventTap)
}

func save(_ image: CGImage, to url: URL) throws {
    guard let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else {
        throw ProbeError.absentRepresentation
    }
    try png.write(to: url)
}

func thumbnail(_ url: URL, edge: CGFloat) throws -> (image: CGImage, milliseconds: UInt64) {
    let request = QLThumbnailGenerator.Request(fileAt: url, size: CGSize(width: edge, height: edge),
                                               scale: 1, representationTypes: .thumbnail)
    let start = DispatchTime.now()
    let done = DispatchSemaphore(value: 0)
    var milliseconds: UInt64 = 0
    var response: Result<QLThumbnailRepresentation, Error>?
    QLThumbnailGenerator.shared.generateBestRepresentation(for: request) { representation, error in
        milliseconds = elapsedMilliseconds(since: start)
        response = representation.map { .success($0) } ?? .failure(error ?? ProbeError.absentRepresentation)
        done.signal()
    }
    let deadline = start + .seconds(12)
    while done.wait(timeout: .now()) == .timedOut {
        if DispatchTime.now() >= deadline {
            QLThumbnailGenerator.shared.cancel(request)
            throw ProbeError.timeout
        }
        RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.02))
    }
    guard let reply = try response?.get() else { throw ProbeError.absentRepresentation }
    print("\(url.lastPathComponent)\t\(reply.type.rawValue)\t\(milliseconds) ms")
    guard reply.type == .thumbnail else { throw ProbeError.wrongRepresentation }
    return (reply.cgImage, milliseconds)
}

// Compare premultiplied colour and alpha on a shared grid so the small icon
// and the PDF reference can have different raster sizes.
private let sampleSide = 32

func samples(_ image: CGImage) -> [UInt8] {
    let side = sampleSide
    var pixels = [UInt8](repeating: 0, count: side * side * 4)
    pixels.withUnsafeMutableBytes { buffer in
        let context = CGContext(data: buffer.baseAddress, width: side, height: side,
                                bitsPerComponent: 8, bytesPerRow: side * 4,
                                space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: side, height: side))
    }
    return pixels
}

func distance(_ first: CGImage, _ second: CGImage) -> Double {
    let lhs = samples(first)
    return Double(zip(lhs, samples(second)).reduce(0) { $0 + abs(Int($1.0) - Int($1.1)) })
        / Double(lhs.count * 255)
}

func elapsedMilliseconds(since start: DispatchTime) -> UInt64 {
    (DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
}

func checkThumbnails(fixtures: URL, output: URL, privateFixtures: URL, iconPDF: URL, smallIconPDF: URL) throws {
    guard let pdf = CGPDFDocument(fixtures.appendingPathComponent("expected.pdf") as CFURL),
          let page = pdf.page(at: 1),
          let iconDocument = CGPDFDocument(iconPDF as CFURL),
          let iconPage = iconDocument.page(at: 1),
          let smallIconDocument = CGPDFDocument(smallIconPDF as CFURL),
          let smallIconPage = smallIconDocument.page(at: 1),
          let context = CGContext(data: nil, width: 720, height: 405, bitsPerComponent: 8,
                                  bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
        throw ProbeError.absentRepresentation
    }
    context.drawPDFPage(page)
    guard let reference = context.makeImage() else { throw ProbeError.absentRepresentation }
    try save(reference, to: output.appendingPathComponent("page-one.png"))
    var matches = true
    let requests: [(String, CGFloat, Bool, String)] = [
        ("café", 512, true, "PDF page 1"),
        ("private", 1024, true, "PDF page 1 above 720 pt, filled edge to edge"),
        ("stale", 512, false, "deck icon (stale cache)"),
        ("missing", 512, false, "deck icon (missing cache)"),
        ("large-source", 512, false, "deck icon (source above 16 MiB)"),
        ("small", 48, false, "deck icon (48 px, valid cache)"),
    ]
    for (name, edge, expectsPage, expectation) in requests {
        let directory = name == "private" ? privateFixtures : fixtures
        let file = directory.appendingPathComponent("\(name).rtms")
        let start = DispatchTime.now()
        do {
            let (image, milliseconds) = try thumbnail(file, edge: edge)
            try save(image, to: output.appendingPathComponent("\(name).png"))
            let pageDifference = distance(image, reference)
            let passed: Bool
            let metrics: String
            if expectsPage {
                let aspect = Double(image.width) / Double(image.height)
                let pixels = samples(image)
                let lastRow = pixels.count - sampleSide * 4
                let lastPixel = pixels.count - 4
                let corners = [0, (sampleSide - 1) * 4, lastRow, lastPixel]
                let edgeAlpha = corners.map { pixels[$0 + 3] }.min() ?? 0
                passed = abs(aspect - 16.0 / 9) < 0.02 && pageDifference < 0.08
                    && (edge <= 720 || (image.width > 720 && edgeAlpha >= 250))
                metrics = "\(image.width)×\(image.height) px, aspect \(aspect), minimum corner alpha \(edgeAlpha), page 1 distance \(pageDifference)"
            } else {
                guard let iconContext = CGContext(data: nil, width: Int(edge), height: Int(edge),
                                                  bitsPerComponent: 8, bytesPerRow: 0,
                                                  space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
                    throw ProbeError.absentRepresentation
                }
                // The provider's rule: the small icon below 64 px, the large from 64 px up, fitted and
                // centred, scaling up as well as down.
                let chosen = edge < 64 ? smallIconPage : iconPage
                let box = chosen.getBoxRect(.mediaBox)
                let scale = min(edge / box.width, edge / box.height)
                iconContext.translateBy(x: (edge - box.width * scale) / 2, y: (edge - box.height * scale) / 2)
                iconContext.scaleBy(x: scale, y: scale)
                iconContext.translateBy(x: -box.minX, y: -box.minY)
                iconContext.drawPDFPage(chosen)
                guard let icon = iconContext.makeImage() else { throw ProbeError.absentRepresentation }
                try save(icon, to: output.appendingPathComponent("\(name)-deck-icon.png"))
                let iconDifference = distance(image, icon)
                passed = iconDifference < 0.12 && pageDifference > 0.14 && milliseconds < 1_000
                metrics = "deck icon distance \(iconDifference), page 1 distance \(pageDifference), budget < 1000 ms"
            }
            print("- \(name) thumbnail — \(passed ? "PASS" : "FAIL") expected \(expectation); \(metrics), \(milliseconds) ms ([PNG](\(output.deletingLastPathComponent().lastPathComponent)/png/\(name).png))")
            matches = matches && passed
        } catch {
            print("- \(name) thumbnail — FAIL expected \(expectation); \(error) after \(elapsedMilliseconds(since: start)) ms")
            matches = false
        }
    }
    guard matches else { throw ProbeError.imageMismatch }
}

@main
enum Probe {
    static func main() {
        setbuf(stdout, nil)
        let arguments = Array(CommandLine.arguments.dropFirst())
        do {
            if arguments.first == "--ocr" {
                let text = try recognizedText(URL(fileURLWithPath: arguments[1]))
                print(text)
                let expectedLabels = arguments.dropFirst(2)
                guard !expectedLabels.isEmpty, expectedLabels.allSatisfy({
                    text.localizedCaseInsensitiveContains($0)
                }) else { throw ProbeError.missingText }
            } else if arguments.first == "--settings-ocr" {
                print(try recognizedText(URL(fileURLWithPath: arguments[1]), separator: "\n"))
            } else if arguments.first == "--settings-display-height" {
                print(Int(CGDisplayBounds(CGMainDisplayID()).height))
            } else if let action = arguments.first,
                      ["--settings-scroll-end", "--settings-scroll-start", "--settings-scroll", "--settings-category"].contains(action) {
                try settingsAction(action)
            } else if arguments.first == "--settings-window" {
                guard let window = settingsWindowID() else { throw ProbeError.absentRepresentation }
                print(window)
            } else {
                try checkThumbnails(fixtures: URL(fileURLWithPath: arguments[0], isDirectory: true),
                                    output: URL(fileURLWithPath: arguments[1], isDirectory: true),
                                    privateFixtures: URL(fileURLWithPath: arguments[2], isDirectory: true),
                                    iconPDF: URL(fileURLWithPath: arguments[3]),
                                    smallIconPDF: URL(fileURLWithPath: arguments[4]))
            }
        } catch {
            fputs("Probe failed: \(error)\n", stderr)
            exit(1)
        }
    }
}
