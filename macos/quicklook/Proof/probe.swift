import AppKit
import QuickLookThumbnailing
import Vision

enum ProbeError: Error {
    case timeout, absentRepresentation, wrongRepresentation, imageMismatch, missingText
}

func recognizedText(_ url: URL) throws -> String {
    let request = VNRecognizeTextRequest()
    try VNImageRequestHandler(url: url).perform([request])
    return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ")
}

func save(_ image: CGImage, to url: URL) throws {
    guard let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else {
        throw ProbeError.absentRepresentation
    }
    try png.write(to: url)
}

func thumbnail(_ url: URL, edge: CGFloat, type: QLThumbnailGenerator.Request.RepresentationTypes) throws -> CGImage {
    let request = QLThumbnailGenerator.Request(fileAt: url, size: CGSize(width: edge, height: edge),
                                               scale: 1, representationTypes: type)
    let start = DispatchTime.now()
    let done = DispatchSemaphore(value: 0)
    var response: Result<QLThumbnailRepresentation, Error>?
    QLThumbnailGenerator.shared.generateBestRepresentation(for: request) { representation, error in
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
    print("\(url.lastPathComponent)\t\(type.rawValue)\t\(reply.type.rawValue)\t\(elapsedMilliseconds(since: start)) ms")
    guard reply.type == (type == .icon ? .icon : .thumbnail) else { throw ProbeError.wrongRepresentation }
    return reply.cgImage
}

// Compare premultiplied colour and alpha on a shared grid so the small icon
// and the system reference can have different raster sizes.
func distance(_ first: CGImage, _ second: CGImage) -> Double {
    func samples(_ image: CGImage) -> [UInt8] {
        let side = 32
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
    let lhs = samples(first)
    return Double(zip(lhs, samples(second)).reduce(0) { $0 + abs(Int($1.0) - Int($1.1)) })
        / Double(lhs.count * 255)
}

func elapsedMilliseconds(since start: DispatchTime) -> UInt64 {
    (DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
}

func checkThumbnails(fixtures: URL, output: URL) throws {
    guard let pdf = CGPDFDocument(fixtures.appendingPathComponent("expected.pdf") as CFURL),
          let page = pdf.page(at: 1),
          let context = CGContext(data: nil, width: 512, height: 288, bitsPerComponent: 8,
                                  bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
        throw ProbeError.absentRepresentation
    }
    let bounds = CGRect(x: 0, y: 0, width: 512, height: 288)
    context.concatenate(page.getDrawingTransform(.mediaBox, rect: bounds, rotate: 0, preserveAspectRatio: true))
    context.drawPDFPage(page)
    guard let reference = context.makeImage() else { throw ProbeError.absentRepresentation }
    try save(reference, to: output.appendingPathComponent("page-one.png"))
    var matches = true
    for (name, edge, expectation) in [("café", 512.0, "PDF page 1"), ("stale", 512.0, "deck icon (stale cache)"),
                                      ("missing", 512.0, "deck icon (missing cache)"), ("small", 48.0, "deck icon (<64 px)")] {
        let file = fixtures.appendingPathComponent("\(name).rtms")
        let start = DispatchTime.now()
        do {
            let image = try thumbnail(file, edge: edge, type: .thumbnail)
            try save(image, to: output.appendingPathComponent("\(name).png"))
            let pageDifference = distance(image, reference)
            let passed: Bool
            let metrics: String
            if name == "café" {
                let aspect = Double(image.width) / Double(image.height)
                passed = abs(aspect - 16.0 / 9) < 0.02 && pageDifference < 0.08
                metrics = "aspect \(aspect), page 1 distance \(pageDifference)"
            } else {
                guard let iconContext = CGContext(data: nil, width: Int(edge), height: Int(edge),
                                                  bitsPerComponent: 8, bytesPerRow: 0,
                                                  space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
                    throw ProbeError.absentRepresentation
                }
                DeckIcon.draw(in: iconContext, size: CGSize(width: edge, height: edge))
                guard let icon = iconContext.makeImage() else { throw ProbeError.absentRepresentation }
                try save(icon, to: output.appendingPathComponent("\(name)-deck-icon.png"))
                // Keep the system's icon as additional evidence alongside our drawing reference.
                if let system = try? thumbnail(file, edge: edge, type: .icon) {
                    try save(system, to: output.appendingPathComponent("\(name)-system-icon.png"))
                }
                let iconDifference = distance(image, icon)
                passed = iconDifference < 0.12 && pageDifference > 0.14
                metrics = "deck icon distance \(iconDifference), page 1 distance \(pageDifference)"
            }
            print("- \(name) thumbnail — \(passed ? "PASS" : "FAIL") expected \(expectation); \(metrics), \(elapsedMilliseconds(since: start)) ms ([PNG](\(output.deletingLastPathComponent().lastPathComponent)/png/\(name).png))")
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
                guard text.uppercased().contains(arguments[2]) else { throw ProbeError.missingText }
            } else {
                try checkThumbnails(fixtures: URL(fileURLWithPath: arguments[0], isDirectory: true),
                                    output: URL(fileURLWithPath: arguments[1], isDirectory: true))
            }
        } catch {
            fputs("Probe failed: \(error)\n", stderr)
            exit(1)
        }
    }
}
