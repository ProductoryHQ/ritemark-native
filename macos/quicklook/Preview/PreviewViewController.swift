import AppKit
import QuickLookUI

final class PreviewViewController: NSViewController, QLPreviewingController {
    private var renderer: DeckRenderer?

    override func loadView() {
        view = NSView(frame: DeckRenderer.canvas)
    }

    func preparePreviewOfFile(at url: URL, completionHandler handler: @escaping (Error?) -> Void) {
        // The extension advertises only the deck UTI, so LaunchServices routes Markdown to its system preview.
        guard url.pathExtension.lowercased() == "rtms" else {
            handler(DeckRenderError.unsupportedFile)
            return
        }
        renderer?.view.removeFromSuperview()
        let next = DeckRenderer()
        renderer = next
        next.view.frame = view.bounds
        next.view.autoresizingMask = [.width, .height]
        view.addSubview(next.view)
        let name = url.lastPathComponent
        next.render(url, thumbnail: false) { result in
            switch result {
            case .success(let slides):
                proofLog.notice("preview drawn \(name, privacy: .public) \(slides.joined(separator: " | "), privacy: .public)")
                handler(nil)
            case .failure(let error):
                proofLog.notice("preview failed \(name, privacy: .public) \(String(describing: error), privacy: .public)")
                handler(error)
            }
        }
    }
}
