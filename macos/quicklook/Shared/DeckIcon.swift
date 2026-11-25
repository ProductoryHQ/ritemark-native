import AppKit
import UniformTypeIdentifiers

enum DeckIcon {
    static func draw(in context: CGContext, size: CGSize) {
        let bounds = CGRect(origin: .zero, size: size)
        let workspace = NSWorkspace.shared
        if let type = UTType("ai.productory.ritemark.deck") {
            let icon = workspace.icon(for: type)
            let generic = workspace.icon(for: .data)
            let genericDocument = workspace.icon(for: .item)
            if let bytes = icon.tiffRepresentation,
               bytes != generic.tiffRepresentation, bytes != genericDocument.tiffRepresentation,
               draw(icon, in: context, bounds: bounds) {
                return
            }
        }

        // TODO(Experience): install DeckIcon.icns from experiences/decks/file-icon/.
        if let url = Bundle.main.url(forResource: "DeckIcon", withExtension: "icns"),
           let icon = NSImage(contentsOf: url), draw(icon, in: context, bounds: bounds) {
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

    private static func draw(_ image: NSImage, in context: CGContext, bounds: CGRect) -> Bool {
        var target = bounds
        guard let cgImage = image.cgImage(forProposedRect: &target, context: nil, hints: nil) else {
            return false
        }
        context.draw(cgImage, in: bounds)
        return true
    }
}
