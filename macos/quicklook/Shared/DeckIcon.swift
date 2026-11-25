import AppKit
import UniformTypeIdentifiers

enum DeckIcon {
    private static let image: NSImage? = {
        let workspace = NSWorkspace.shared
        if let type = UTType("ai.productory.ritemark.deck") {
            let icon = workspace.icon(for: type)
            if let bytes = icon.tiffRepresentation,
               bytes != workspace.icon(for: .data).tiffRepresentation,
               bytes != workspace.icon(for: .item).tiffRepresentation {
                return icon
            }
        }
        // TODO(Experience): install DeckIcon.icns from experiences/decks/file-icon/.
        return Bundle(for: ResourceBundle.self)
            .url(forResource: "DeckIcon", withExtension: "icns").flatMap { NSImage(contentsOf: $0) }
    }()
    private final class ResourceBundle: NSObject {}
    private static let imageLock = NSLock()

    static func draw(in context: CGContext, size: CGSize) {
        if let image {
            imageLock.lock()
            defer { imageLock.unlock() }
            NSGraphicsContext.saveGraphicsState()
            defer { NSGraphicsContext.restoreGraphicsState() }
            NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
            image.draw(in: CGRect(origin: .zero, size: size))
            return
        }

        // Keep an identifiable deck icon even without a registered or bundled icon.
        context.saveGState()
        defer { context.restoreGState() }
        context.scaleBy(x: size.width / 64, y: size.height / 64)
        context.setFillColor(red: 0.97, green: 0.97, blue: 0.99, alpha: 1)
        context.addLines(between: [CGPoint(x: 10, y: 3), CGPoint(x: 54, y: 3),
                                   CGPoint(x: 54, y: 46),
                                   CGPoint(x: 39, y: 61), CGPoint(x: 10, y: 61)])
        context.closePath()
        context.fillPath()
        context.setFillColor(red: 0.82, green: 0.83, blue: 0.90, alpha: 1)
        context.addLines(between: [CGPoint(x: 39, y: 61), CGPoint(x: 39, y: 46),
                                   CGPoint(x: 54, y: 46)])
        context.closePath()
        context.fillPath()
        context.setFillColor(red: 0.28, green: 0.24, blue: 0.69, alpha: 1)
        context.fill(CGRect(x: 18, y: 25, width: 28, height: 17))
        context.setStrokeColor(red: 0.28, green: 0.24, blue: 0.69, alpha: 1)
        context.setLineWidth(3)
        context.addLines(between: [CGPoint(x: 23, y: 13), CGPoint(x: 32, y: 27),
                                   CGPoint(x: 41, y: 13)])
        context.strokePath()
    }

}
