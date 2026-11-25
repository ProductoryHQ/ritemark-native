import AppKit
import QuickLookThumbnailing
import WebKit

final class ThumbnailProvider: QLThumbnailProvider {
    private var idleRenderer: DeckRenderer?

    override func provideThumbnail(for request: QLFileThumbnailRequest,
                                   _ handler: @escaping (QLThumbnailReply?, Error?) -> Void) {
        proofLog.notice("thumbnail started \(request.fileURL.lastPathComponent, privacy: .public)")
        let deadline = DispatchTime.now() + .seconds(10)
        let finish = ThumbnailCompletion(handler)
        // The timeout must also fire if WebKit or an asset read stalls the main thread.
        DispatchQueue.global().asyncAfter(deadline: deadline) {
            if finish.answer(nil) {
                proofLog.notice("thumbnail timeout \(request.fileURL.lastPathComponent, privacy: .public)")
            }
        }
        DispatchQueue.main.async {
            guard DispatchTime.now() < deadline else { return }
            let renderer = self.idleRenderer ?? DeckRenderer()
            self.idleRenderer = nil
            let window = NSWindow(contentRect: DeckRenderer.canvas, styleMask: .borderless,
                                  backing: .buffered, defer: false)
            window.setFrameOrigin(NSPoint(x: -10_000, y: -10_000))
            window.contentView = renderer.view
            window.orderBack(nil)
            // The queued cleanup owns the renderer and its window through the request deadline.
            let cleanup = DispatchWorkItem {
                window.orderOut(nil)
                window.contentView = nil
                renderer.stop()
            }
            DispatchQueue.main.asyncAfter(deadline: deadline, execute: cleanup)
            let rendered: (Result<[String], Error>) -> Void = { result in
                guard !cleanup.isCancelled, DispatchTime.now() < deadline else { return }
                guard case .success = result else {
                    if case .failure(let error) = result {
                        proofLog.notice("thumbnail empty \(request.fileURL.lastPathComponent, privacy: .public) \(String(describing: error), privacy: .public)")
                    }
                    finish.answer(nil)
                    return
                }
                let width = min(request.maximumSize.width, request.maximumSize.height * 960 / 540)
                guard width > 0 else {
                    proofLog.notice("thumbnail empty \(request.fileURL.lastPathComponent, privacy: .public) invalid size")
                    finish.answer(nil)
                    return
                }
                let size = CGSize(width: width, height: width * 540 / 960)
                let snapshot = WKSnapshotConfiguration()
                snapshot.rect = DeckRenderer.canvas
                snapshot.snapshotWidth = NSNumber(value: max(1, width * request.scale))
                renderer.view.takeSnapshot(with: snapshot) { [renderer, window] image, error in
                    proofLog.notice("thumbnail snapshot callback image=\(image != nil) error=\(String(describing: error), privacy: .public)")
                    guard DispatchTime.now() < deadline else { return }
                    cleanup.cancel()
                    window.orderOut(nil)
                    window.contentView = nil
                    self.idleRenderer = renderer
                    guard let cgImage = image?.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
                        proofLog.notice("thumbnail empty \(request.fileURL.lastPathComponent, privacy: .public) snapshot unavailable")
                        finish.answer(nil)
                        return
                    }
                    let reply = QLThumbnailReply(contextSize: size) { context in
                        context.draw(cgImage, in: CGRect(origin: .zero, size: size))
                        return true
                    }
                    if finish.answer(reply) {
                        proofLog.notice("thumbnail drawn \(request.fileURL.lastPathComponent, privacy: .public)")
                    }
                }
            }
            #if QUICKLOOK_MINIMAL
            renderer.renderStatic(completion: rendered)
            #else
            renderer.render(request.fileURL, thumbnail: true, completion: rendered)
            #endif
        }
    }
}

private final class ThumbnailCompletion {
    private let start = DispatchTime.now().uptimeNanoseconds
    private let lock = NSLock()
    private var handler: ((QLThumbnailReply?, Error?) -> Void)?

    init(_ handler: @escaping (QLThumbnailReply?, Error?) -> Void) { self.handler = handler }

    @discardableResult
    func answer(_ reply: QLThumbnailReply?) -> Bool {
        lock.lock()
        let callback = handler
        handler = nil
        lock.unlock()
        guard let callback else { return false }
        let elapsed = (DispatchTime.now().uptimeNanoseconds - start) / 1_000_000
        proofLog.notice("thumbnail reply image=\(reply != nil) elapsed_ms=\(elapsed)")
        callback(reply, nil)
        return true
    }
}
