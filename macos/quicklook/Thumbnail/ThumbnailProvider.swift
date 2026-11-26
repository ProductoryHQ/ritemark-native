import CoreGraphics
import Foundation
import QuickLookThumbnailing

final class ThumbnailProvider: QLThumbnailProvider {
    private static let workers = DispatchQueue(label: "ai.productory.ritemark.quicklook.read",
                                                qos: .userInitiated, attributes: .concurrent)
    private static let slots = DispatchSemaphore(value: 4)

    override func provideThumbnail(for request: QLFileThumbnailRequest,
                                   _ handler: @escaping (QLThumbnailReply?, Error?) -> Void) {
        let start = DispatchTime.now()
        let maximum = request.maximumSize
        let edge = min(maximum.width, maximum.height)
        let pixels = edge * request.scale
        DeckCache.log.info("Thumbnail request: \(Double(pixels)) px")
        let iconSize = CGSize(width: edge, height: edge)
        let icon = QLThumbnailReply(contextSize: iconSize, drawing: { context in
            guard DeckIcon.draw(in: context, size: iconSize, pixels: pixels) else {
                DeckCache.log.error("Bundled deck icon could not be loaded")
                return false
            }
            let elapsed = (DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
            DeckCache.log.info("Thumbnail deck icon in \(elapsed) ms")
            return true
        })
        guard pixels >= 64, Self.slots.wait(timeout: .now()) == .success else {
            handler(icon, nil)
            return
        }

        let deadline = DispatchTime.now() + .seconds(2)
        // Race the read against the deadline and consume the callback exactly once.
        let lock = NSLock()
        var pending: ((QLThumbnailReply?, Error?) -> Void)? = handler
        func finish(_ reply: QLThumbnailReply?) {
            lock.lock()
            let callback = pending
            pending = nil
            lock.unlock()
            callback?(DispatchTime.now() < deadline ? reply ?? icon : icon, nil)
        }
        let timeout = DispatchWorkItem { finish(nil) }
        DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: deadline, execute: timeout)

        Self.workers.async {
            defer {
                timeout.cancel()
                Self.slots.signal()
            }
            let hostID = Bundle(for: Self.self).object(forInfoDictionaryKey: "RitemarkHostBundleIdentifier") as? String ?? ""
            guard let source = DeckCache.Source(request.fileURL),
                  let pdf = DeckCache.pdf(for: source, hostID: hostID),
                  let provider = CGDataProvider(data: pdf as CFData),
                  let document = CGPDFDocument(provider), let page = document.page(at: 1),
                  DispatchTime.now() < deadline, source.matches(request.fileURL) else {
                finish(nil)
                return
            }

            let width = min(maximum.width, maximum.height * 16 / 9)
            let bounds = CGRect(x: 0, y: 0, width: width, height: width * 9 / 16)
            let mediaBox = page.getBoxRect(.mediaBox)
            guard mediaBox.width > 0, mediaBox.height > 0 else {
                finish(nil)
                return
            }
            let scale = bounds.width / mediaBox.width
            let transform = CGAffineTransform(scaleX: scale, y: scale)
                .translatedBy(x: -mediaBox.minX, y: -mediaBox.minY)
            finish(QLThumbnailReply(contextSize: bounds.size, drawing: { context in
                let elapsed = (DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
                DeckCache.log.info("Thumbnail PDF page 1 in \(elapsed) ms")
                context.concatenate(transform)
                context.drawPDFPage(page)
                return true
            }))
        }
    }
}
