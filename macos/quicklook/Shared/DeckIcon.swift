import CoreGraphics
import Foundation

/// The deck file icon (the Experience lead's design, the same as Windows): the small version below 64 px,
/// the large one from 64 px up. Drawn from bundled PDFs with Core Graphics, never through IconServices,
/// which is slow or hangs from inside the sandbox.
enum DeckIcon {
    private static func load(_ name: String) -> CGPDFDocument? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "pdf") else { return nil }
        return CGPDFDocument(url as CFURL)
    }
    private static let large = load("DeckIcon")
    private static let small = load("DeckIconSmall")
    private static let drawingLock = NSLock()

    /// `pixels` is the reply's edge in device pixels (edge × scale), which picks the version.
    static func draw(in context: CGContext, size: CGSize, pixels: CGFloat) -> Bool {
        drawingLock.lock()
        defer { drawingLock.unlock() }
        guard let page = ((pixels < 64 ? small : large) ?? large)?.page(at: 1) else { return false }

        context.saveGState()
        defer { context.restoreGState() }
        // Fit the square page into the reply, centred, scaling up as well as down
        // (getDrawingTransform never scales up).
        let box = page.getBoxRect(.mediaBox)
        guard box.width > 0, box.height > 0 else { return false }
        let scale = min(size.width / box.width, size.height / box.height)
        let drawn = CGSize(width: box.width * scale, height: box.height * scale)
        context.translateBy(x: (size.width - drawn.width) / 2, y: (size.height - drawn.height) / 2)
        context.scaleBy(x: scale, y: scale)
        context.translateBy(x: -box.minX, y: -box.minY)
        context.drawPDFPage(page)
        return true
    }
}
