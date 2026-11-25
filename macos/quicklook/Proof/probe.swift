import AppKit
import QuickLookThumbnailing
import Vision

func recognizedText(_ url: URL) throws -> String {
    let request = VNRecognizeTextRequest()
    try VNImageRequestHandler(url: url).perform([request])
    return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ")
}

func thumbnail(_ url: URL, output: URL, iconsOnly: Bool) {
    let request = QLThumbnailGenerator.Request(fileAt: url, size: CGSize(width: 512, height: 512),
                                               scale: 1, representationTypes: iconsOnly ? .icon : .all)
    let start = DispatchTime.now().uptimeNanoseconds
    let done = DispatchSemaphore(value: 0)
    let name = url.lastPathComponent
    var response: (QLThumbnailRepresentation?, Error?, UInt64)?
    QLThumbnailGenerator.shared.generateBestRepresentation(for: request) { representation, error in
        let elapsed = (DispatchTime.now().uptimeNanoseconds - start) / 1_000_000
        response = (representation, error, elapsed)
        done.signal()
    }
    let deadline = DispatchTime.now() + .seconds(12)
    while done.wait(timeout: .now()) == .timedOut {
        if DispatchTime.now() >= deadline {
            print("\(name)\t12000\ttimeout\t")
            fflush(stdout)
            QLThumbnailGenerator.shared.cancel(request)
            return
        }
        RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.02))
    }
    // Measure the Quick Look callback deadline independently of PNG writing and OCR.
    guard let (representation, error, elapsed) = response else { return }
    guard let representation else {
        print("\(name)\t\(elapsed)\tnone\t\(error?.localizedDescription ?? "no representation")")
        return
    }
    let image = NSBitmapImageRep(cgImage: representation.cgImage)
    let png = output.appendingPathComponent(name + ".png")
    do {
        try image.representation(using: .png, properties: [:])?.write(to: png)
        let kind: String
        switch representation.type {
        case .icon: kind = "icon"
        case .lowQualityThumbnail: kind = "low-quality-thumbnail"
        case .thumbnail: kind = "thumbnail"
        @unknown default: kind = "unknown"
        }
        print("\(name)\t\(elapsed)\t\(kind)\t\((try? recognizedText(png)) ?? "")")
    } catch {
        print("\(name)\t\(elapsed)\terror\t\(error)")
    }
}

let arguments = Array(CommandLine.arguments.dropFirst())
if arguments.first == "--ocr" {
    for path in arguments.dropFirst() {
        let url = URL(fileURLWithPath: path)
        print("\(url.lastPathComponent)\t\((try? recognizedText(url)) ?? "")")
    }
} else if arguments.count >= 2 {
    let iconsOnly = arguments.first == "--icon"
    let files = arguments.dropFirst(iconsOnly ? 1 : 0)
    guard let directory = files.first, files.count >= 2 else { exit(2) }
    let output = URL(fileURLWithPath: directory, isDirectory: true)
    for path in files.dropFirst() {
        thumbnail(URL(fileURLWithPath: path), output: output, iconsOnly: iconsOnly)
    }
} else {
    fputs("Usage: probe [--icon] <png-directory> <file>... or probe --ocr <png>...\n", stderr)
    exit(2)
}
