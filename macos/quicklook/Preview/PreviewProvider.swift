import CoreGraphics
import Foundation
import QuickLookUI
import UniformTypeIdentifiers

final class PreviewProvider: QLPreviewProvider, QLPreviewingController {
    func providePreview(for request: QLFilePreviewRequest) async throws -> QLPreviewReply {
        let start = DispatchTime.now()
        DeckCache.log.info("Preview request")
        let hostID = Bundle(for: Self.self).object(forInfoDictionaryKey: "RitemarkHostBundleIdentifier") as? String ?? ""
        let (type, size, bytes) = try Self.payload(for: request.fileURL, hostID: hostID)
        return QLPreviewReply(dataOfContentType: type, contentSize: size) { _ in
            let elapsed = (DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
            if type == .pdf, let provider = CGDataProvider(data: bytes as CFData),
               let pdf = CGPDFDocument(provider) {
                DeckCache.log.info("Preview PDF: \(pdf.numberOfPages) pages in \(elapsed) ms")
            } else {
                DeckCache.log.info("Preview plain text: \(bytes.count) bytes in \(elapsed) ms")
            }
            return bytes
        }
    }

    static func payload(for url: URL, hostID: String) throws -> (UTType, CGSize, Data) {
        if let source = DeckCache.Source(url),
           let pdf = DeckCache.pdf(for: source, hostID: hostID),
           let provider = CGDataProvider(data: pdf as CFData),
           let document = CGPDFDocument(provider), let page = document.page(at: 1),
           source.matches(url) {
            return (.pdf, page.getBoxRect(.mediaBox).size, pdf)
        }
        return (.plainText, .zero, try Data(contentsOf: url, options: .alwaysMapped))
    }
}
