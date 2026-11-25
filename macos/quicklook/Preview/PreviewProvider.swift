import CoreGraphics
import Foundation
import QuickLookUI
import UniformTypeIdentifiers

final class PreviewProvider: QLPreviewProvider, QLPreviewingController {
    func providePreview(for request: QLFilePreviewRequest) async throws -> QLPreviewReply {
        let hostID = Bundle.main.object(forInfoDictionaryKey: "RitemarkHostBundleIdentifier") as? String ?? ""
        let (type, size, bytes) = try Self.payload(for: request.fileURL, hostID: hostID)
        return QLPreviewReply(dataOfContentType: type, contentSize: size) { _ in bytes }
    }

    static func payload(for url: URL, hostID: String) throws -> (UTType, CGSize, Data) {
        let source = try DeckCache.Source(url)
        if let pdf = DeckCache.pdf(for: source, hostID: hostID),
           let provider = CGDataProvider(data: pdf as CFData),
           let document = CGPDFDocument(provider), let page = document.page(at: 1) {
            let current = try DeckCache.Source(url)
            if current.path == source.path && current.bytes == source.bytes {
                return (.pdf, page.getBoxRect(.mediaBox).size, pdf)
            }
            return (.plainText, .zero, current.bytes)
        }
        return (.plainText, .zero, source.bytes)
    }
}
