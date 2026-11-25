import CryptoKit
import Darwin
import Foundation

enum DeckCache {
    private struct Entry: Decodable {
        let v: Int
        let source: String
        let sourceSha256: String
        let pdfSha256: String
        let slides: Int
        let appVersion: String
        let drawnAt: String
        let inputs: String

        var isValid: Bool {
            let date = ISO8601DateFormatter()
            date.formatOptions.insert(.withFractionalSeconds)
            if date.date(from: drawnAt) == nil {
                date.formatOptions.remove(.withFractionalSeconds)
                guard date.date(from: drawnAt) != nil else { return false }
            }
            return v == 1 && slides >= 1
                && appVersion.range(of: #"\A[0-9]+\.[0-9]+\.[0-9]+\z"#, options: .regularExpression) != nil
                && inputs.range(of: #"\A[0-9a-f]{64}\z"#, options: .regularExpression) != nil
        }
    }

    struct Source {
        let url: URL
        let path: String
        let bytes: Data

        init(_ requestedURL: URL) throws {
            url = requestedURL.resolvingSymlinksInPath()
            path = url.path.precomposedStringWithCanonicalMapping
            bytes = try Data(contentsOf: url)
        }

        func matches(_ requestedURL: URL) -> Bool {
            guard let latest = try? Source(requestedURL) else { return false }
            return latest.path == path && latest.bytes == bytes
        }
    }

    static func pdf(for source: Source, hostID: String) -> Data? {
        guard hostID.range(of: #"\A[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\z"#, options: .regularExpression) != nil,
              let home = NSHomeDirectoryForUser(NSUserName()) else { return nil }
        let key = digest(Data(source.path.utf8))
        let homeFD = open(URL(fileURLWithPath: home).resolvingSymlinksInPath().path, O_RDONLY | O_DIRECTORY | O_CLOEXEC)
        guard homeFD >= 0 else { return nil }
        var directory = homeFD
        defer { close(directory) }

        // Pin each directory before opening the next component. A rename or
        // symlink swap cannot redirect a subsequent read outside this chain.
        for component in ["Library", "Caches", hostID, "quicklook", "v1", key] {
            let next = openat(directory, component, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
            guard next >= 0 else { return nil }
            close(directory)
            directory = next
        }
        guard let json = read("entry.json", in: directory, limit: 64 * 1024),
              !json.contains(0), String(data: json, encoding: .utf8) != nil,
              let entry = try? JSONDecoder().decode(Entry.self, from: json),
              entry.isValid, entry.source.utf8.elementsEqual(source.path.utf8),
              digest(source.bytes) == entry.sourceSha256,
              let pdf = read("slides.pdf", in: directory, limit: 50 * 1024 * 1024),
              digest(pdf) == entry.pdfSha256 else { return nil }
        return pdf
    }

    private static func digest(_ bytes: Data) -> String {
        SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    }

    private static func read(_ name: String, in directory: Int32, limit: Int) -> Data? {
        let fd = openat(directory, name, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC)
        guard fd >= 0 else { return nil }
        let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
        defer { try? handle.close() }
        var info = stat()
        guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFREG,
              info.st_size <= limit else { return nil }
        do {
            var bytes = Data()
            while let chunk = try handle.read(upToCount: min(64 * 1024, limit + 1 - bytes.count)),
                  !chunk.isEmpty {
                bytes.append(chunk)
                guard bytes.count <= limit else { return nil }
            }
            return bytes
        } catch {
            return nil
        }
    }
}
