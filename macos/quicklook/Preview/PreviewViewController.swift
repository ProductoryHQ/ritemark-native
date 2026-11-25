import AppKit
import QuickLookUI
import WebKit

final class PreviewViewController: NSViewController, QLPreviewingController {
    private var renderer: DeckRenderer?

    override func loadView() {
        view = NSView(frame: DeckRenderer.canvas)
    }

    func preparePreviewOfFile(at url: URL, completionHandler handler: @escaping (Error?) -> Void) {
        let start = DispatchTime.now()
        proofLog.notice("preview started \(url.lastPathComponent, privacy: .public)")
        renderer?.view.removeFromSuperview()
        let next = DeckRenderer()
        renderer = next
        next.view.frame = view.bounds
        next.view.autoresizingMask = [.width, .height]
        view.addSubview(next.view)

        var reply: ((Error?) -> Void)? = handler
        let finish: (Error?) -> Void = { error in
            guard let callback = reply else { return }
            reply = nil
            let elapsed = (DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
            proofLog.notice("preview reply elapsed_ms=\(elapsed) error=\(String(describing: error), privacy: .public)")
            callback(error)
        }
        let timeout = DispatchWorkItem {
            finish(URLError(.timedOut))
            next.stop()
        }
        DispatchQueue.main.asyncAfter(deadline: start + .seconds(10), execute: timeout)
        next.render(url, thumbnail: false, firstOnly: true) { [weak next] result in
            guard let next, !timeout.isCancelled else { return }
            switch result {
            case .success:
                next.view.takeSnapshot(with: nil) { [next] image, error in
                    proofLog.notice("preview snapshot callback image=\(image != nil) error=\(String(describing: error), privacy: .public)")
                    guard !timeout.isCancelled, DispatchTime.now() < start + .seconds(10) else { return }
                    timeout.cancel()
                    withExtendedLifetime(next) {
                        finish(error ?? (image == nil ? DeckRenderError.unexpectedResponse : nil))
                    }
                    if let image { Self.saveSnapshot(image) }
                }
            case .failure(let error):
                timeout.cancel()
                finish(error)
            }
        }
    }

    private static func saveSnapshot(_ image: NSImage) {
        guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil),
              let png = NSBitmapImageRep(cgImage: cgImage).representation(using: .png, properties: [:]) else {
            proofLog.error("preview snapshot PNG encoding failed")
            return
        }
        // The probe copies this from the extension's writable temporary directory.
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("quicklook-preview-snapshot.png")
        do {
            try png.write(to: url, options: .atomic)
            proofLog.notice("preview snapshot PNG path=\(url.path, privacy: .public)")
        } catch {
            proofLog.error("preview snapshot PNG write failed: \(String(describing: error), privacy: .public)")
        }
    }
}
