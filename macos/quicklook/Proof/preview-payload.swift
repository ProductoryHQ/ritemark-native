import CoreGraphics
import Foundation
import UniformTypeIdentifiers

@main
enum PreviewProof {
    static func main() throws {
        let fixtures = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
        let hostID = CommandLine.arguments[2]
        let expectedPDF = try Data(contentsOf: fixtures.appendingPathComponent("expected.pdf"))
        for name in ["café", "alias", "stale", "mixed", "linked-file", "linked-entry", "oversize", "oversize-manifest", "missing"] {
            let url = fixtures.appendingPathComponent("\(name).rtms")
            let (type, _, bytes) = try PreviewProvider.payload(for: url, hostID: hostID)
            if name == "café" || name == "alias" {
                guard type == .pdf, bytes == expectedPDF,
                      let provider = CGDataProvider(data: bytes as CFData),
                      CGPDFDocument(provider)?.numberOfPages == 2 else {
                    fatalError("\(name): expected two-page fixture PDF")
                }
                print("\(name)\tPDF\t2 pages")
            } else {
                let source = try Data(contentsOf: url)
                guard type == .plainText, bytes == source else {
                    fatalError("\(name): expected exact current source bytes")
                }
                print("\(name)\tplain text\t\(bytes.count) bytes")
            }
        }
        do {
            _ = try PreviewProvider.payload(for: fixtures.appendingPathComponent("absent.rtms"), hostID: hostID)
            fatalError("Expected system read error")
        } catch let error as NSError where error.domain == NSCocoaErrorDomain
            && error.code == NSFileReadNoSuchFileError {
            print("absent\t\(error.domain)\t\(error.code)")
        }
    }
}
