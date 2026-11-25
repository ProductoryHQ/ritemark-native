import AppKit
import OSLog
import UniformTypeIdentifiers
import WebKit

let proofLog = Logger(subsystem: "ai.productory.ritemark.quicklook-proof", category: "render")

enum DeckRenderError: Error {
    case resourceUnavailable, unexpectedResponse, noSlides, unsupportedFile
}

final class DeckRenderer: NSObject, WKNavigationDelegate {
    static let canvas = CGRect(x: 0, y: 0, width: 960, height: 540)
    private static let world = WKContentWorld.world(name: "Ritemark Quick Look")
    let view: WKWebView
    private var loaded: ((Error?) -> Void)?

    override init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        view = WKWebView(frame: Self.canvas, configuration: configuration)
        super.init()
        view.navigationDelegate = self
    }

    func render(_ url: URL, thumbnail: Bool, completion: @escaping (Result<[String], Error>) -> Void) {
        guard url.pathExtension.lowercased() == "rtms" else {
            completion(.failure(DeckRenderError.unsupportedFile))
            return
        }
        do {
            guard let script = Bundle.main.url(forResource: "renderer", withExtension: "js") else {
                throw DeckRenderError.resourceUnavailable
            }
            let source = try String(contentsOf: script, encoding: .utf8)
            let text = try String(contentsOf: url, encoding: .utf8)
            let scripts = view.configuration.userContentController
            scripts.removeAllUserScripts()
            scripts.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart,
                                               forMainFrameOnly: true, in: Self.world))
            loaded = { [weak self] error in
                if let error {
                    completion(.failure(error))
                } else {
                    self?.draw(text, url: url, thumbnail: thumbnail, completion: completion)
                }
            }
            view.loadHTMLString("""
                <!doctype html><meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <meta http-equiv="Content-Security-Policy"
                      content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; base-uri 'none'; form-action 'none'">
                """, baseURL: nil)
        } catch {
            completion(.failure(error))
        }
    }

    private func draw(_ text: String, url: URL, thumbnail: Bool,
                      completion: @escaping (Result<[String], Error>) -> Void) {
        let folder = url.deletingLastPathComponent().resolvingSymlinksInPath()
        let name = url.lastPathComponent
        let mode = thumbnail ? "thumbnail" : "preview"
        let arguments: [String: Any] = ["text": text, "thumbnail": thumbnail]
        evaluate("return QuickLookDeck.themePath(text)", arguments) { [weak self] result in
            guard let self else { return }
            do {
                guard let path = try result.get() as? String else { throw DeckRenderError.unexpectedResponse }
                let theme = Self.findTheme(path, from: folder)
                proofLog.notice("\(mode, privacy: .public) theme \(name, privacy: .public) \(theme == nil ? "no" : "yes", privacy: .public)")
                let input = arguments.merging(["theme": theme?.text ?? ""]) { _, new in new }
                self.evaluate("return QuickLookDeck.render(text, theme, thumbnail).paths", input) { [weak self] result in
                    guard let self else { return }
                    do {
                        guard let paths = try result.get() as? [String] else { throw DeckRenderError.unexpectedResponse }
                        var assets: [String: String] = [:]
                        for key in paths {
                            let themeAsset = key.hasPrefix("theme:")
                            let root = themeAsset ? theme?.url.deletingLastPathComponent() : folder
                            if let root, let file = Self.sidecar(String(key.dropFirst(themeAsset ? 6 : 5)), in: root),
                               let image = Self.imageData(file) {
                                assets[key] = image
                            }
                            proofLog.notice("\(mode, privacy: .public) asset \(name, privacy: .public) \(key, privacy: .public) \(assets[key] == nil ? "no" : "yes", privacy: .public)")
                        }
                        self.evaluate("""
                            const { slides } = QuickLookDeck.render(text, theme, thumbnail, assets);
                            return await QuickLookDeck.show(slides, thumbnail, assets);
                            """, input.merging(["assets": assets]) { _, new in new }) { result in
                            completion(result.flatMap { value in
                                guard let slides = value as? [String] else { return .failure(DeckRenderError.unexpectedResponse) }
                                return slides.isEmpty ? .failure(DeckRenderError.noSlides) : .success(slides)
                            })
                        }
                    } catch { completion(.failure(error)) }
                }
            } catch { completion(.failure(error)) }
        }
    }

    private func evaluate(_ source: String, _ arguments: [String: Any],
                          completion: @escaping (Result<Any, Error>) -> Void) {
        view.callAsyncJavaScript(source, arguments: arguments, in: nil, in: Self.world, completionHandler: completion)
    }

    private static func sidecar(_ path: String, in folder: URL) -> URL? {
        let relative = path.split(whereSeparator: { $0 == "#" || $0 == "?" }).first.map(String.init) ?? ""
        let decoded = relative.removingPercentEncoding ?? relative
        guard !decoded.isEmpty, !decoded.hasPrefix("/") else { return nil }
        let root = folder.resolvingSymlinksInPath().standardizedFileURL.path
        let file = folder.appendingPathComponent(decoded).resolvingSymlinksInPath().standardizedFileURL
        let prefix = root == "/" ? root : root + "/"
        guard file.path.hasPrefix(prefix) else { return nil }
        return file
    }

    private static func findTheme(_ path: String, from folder: URL) -> (url: URL, text: String)? {
        let home = FileManager.default.homeDirectoryForCurrentUser.resolvingSymlinksInPath().path
        for candidate in [path, "Slide library/Themes/Evening.theme.md"] {
            var directory = folder
            while true {
                if let file = sidecar(candidate, in: directory),
                   let info = try? file.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]),
                   info.isRegularFile == true, let size = info.fileSize, size <= 64 * 1024,
                   let text = try? String(contentsOf: file, encoding: .utf8) {
                    return (file, text)
                }
                if directory.path == home || directory.path == "/" { break }
                directory.deleteLastPathComponent()
            }
        }
        return nil
    }

    private static func imageData(_ file: URL) -> String? {
        guard let type = UTType(filenameExtension: file.pathExtension), type.conforms(to: .image),
              let mime = type.preferredMIMEType,
              let info = try? file.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]),
              info.isRegularFile == true, let size = info.fileSize, size <= 32 * 1024 * 1024,
              let data = try? Data(contentsOf: file) else { return nil }
        return "data:\(mime);base64,\(data.base64EncodedString())"
    }

    func stop() {
        loaded = nil
        view.stopLoading()
    }

    private func finishLoad(_ error: Error?) {
        let callback = loaded
        loaded = nil
        callback?(error)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { finishLoad(nil) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { finishLoad(error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        finishLoad(error)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(action.request.url?.absoluteString == "about:blank" ? .allow : .cancel)
    }
}
