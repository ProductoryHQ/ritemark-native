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

func thumbnail(_ url: URL, edge: CGFloat) throws -> CGImage {
    let request = QLThumbnailGenerator.Request(fileAt: url, size: CGSize(width: edge, height: edge),
                                               scale: 1, representationTypes: .thumbnail)
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
    print("\(url.lastPathComponent)\t\(reply.type.rawValue)\t\(elapsedMilliseconds(since: start)) ms")
    guard reply.type == .thumbnail else { throw ProbeError.wrongRepresentation }
    return reply.cgImage
}

// Compare premultiplied colour and alpha on a shared grid so the small icon
// and the system reference can have different raster sizes.
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

func checkThumbnails(fixtures: URL, output: URL, privateFixtures: URL) throws {
    guard let pdf = CGPDFDocument(fixtures.appendingPathComponent("expected.pdf") as CFURL),
          let page = pdf.page(at: 1),
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
            let image = try thumbnail(file, edge: edge)
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
                DeckIcon.draw(in: iconContext, size: CGSize(width: edge, height: edge))
                guard let icon = iconContext.makeImage() else { throw ProbeError.absentRepresentation }
                try save(icon, to: output.appendingPathComponent("\(name)-deck-icon.png"))
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
                                    output: URL(fileURLWithPath: arguments[1], isDirectory: true),
                                    privateFixtures: URL(fileURLWithPath: arguments[2], isDirectory: true))
            }
        } catch {
            fputs("Probe failed: \(error)\n", stderr)
            exit(1)
        }
    }
}
