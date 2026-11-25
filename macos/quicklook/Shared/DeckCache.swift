import CryptoKit
import Darwin
import Foundation
import OSLog

enum DeckCache {
    static let log = Logger(subsystem: "ai.productory.ritemark.quicklook", category: "provider")
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
        private static let limit = 16 * 1024 * 1024
        let path: String
        let sha256: String
        private let info: stat

        init?(_ requestedURL: URL) {
            guard let resolved = Self.realPath(requestedURL) else { return nil }
            let fd = open(resolved, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC)
            guard fd >= 0 else { return nil }
            let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
            defer { try? handle.close() }
            var before = stat()
            guard fstat(fd, &before) == 0, before.st_mode & S_IFMT == S_IFREG,
                  before.st_size <= Self.limit else { return nil }
            var hash = SHA256()
            var count = 0
            do {
                while let chunk = try handle.read(upToCount: min(64 * 1024, Self.limit + 1 - count)),
                      !chunk.isEmpty {
                    count += chunk.count
                    guard count <= Self.limit else { return nil }
                    hash.update(data: chunk)
                }
            } catch {
                return nil
            }
            path = resolved.precomposedStringWithCanonicalMapping
            sha256 = hash.finalize().map { String(format: "%02x", $0) }.joined()
            info = before
            guard count == before.st_size, matches(requestedURL) else { return nil }
        }

        // Recheck the file identity and revision before replying, without a second read.
        func matches(_ requestedURL: URL) -> Bool {
            guard let resolved = Self.realPath(requestedURL),
                  resolved.precomposedStringWithCanonicalMapping.utf8.elementsEqual(path.utf8) else { return false }
            var current = stat()
            return lstat(resolved, &current) == 0
                && current.st_dev == info.st_dev && current.st_ino == info.st_ino
                && current.st_size == info.st_size
                && current.st_mtimespec.tv_sec == info.st_mtimespec.tv_sec
                && current.st_mtimespec.tv_nsec == info.st_mtimespec.tv_nsec
                && current.st_ctimespec.tv_sec == info.st_ctimespec.tv_sec
                && current.st_ctimespec.tv_nsec == info.st_ctimespec.tv_nsec
        }

        private static func realPath(_ url: URL) -> String? {
            // Darwin realpath preserves /private and canonical filesystem spelling.
            let resolved = url.withUnsafeFileSystemRepresentation { path in
                path.flatMap { Darwin.realpath($0, nil) }
            }
            defer { free(resolved) }
            return resolved.flatMap { String(validatingUTF8: $0) }
        }
    }

    // Foundation's home APIs can return the extension's sandbox container.
    private static let realHome: String? = {
        guard let home = getpwuid(getuid())?.pointee.pw_dir else { return nil }
        return String(validatingUTF8: home)
    }()

    static func pdf(for source: Source, hostID: String) -> Data? {
        guard hostID.range(of: #"\A[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\z"#, options: .regularExpression) != nil,
              let home = realHome else {
            log.info("Cache miss: host ID or user home unavailable")
            return nil
        }
        let root = "\(home)/Library/Caches/\(hostID)/quicklook/v1"
        let key = digest(Data(source.path.utf8))
        let homeFD = open(home, O_RDONLY | O_DIRECTORY | O_CLOEXEC)
        guard homeFD >= 0 else {
            log.info("Cache miss: opening user home failed, errno \(errno)")
            return nil
        }
        var directory = homeFD
        defer { close(directory) }

        // Pin each directory before opening the next component. A rename or
        // symlink swap cannot redirect a subsequent read outside this chain.
        for (index, component) in ["Library", "Caches", hostID, "quicklook", "v1", key].enumerated() {
            let next = openat(directory, component, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
            guard next >= 0 else {
                // The index identifies Library, Caches, host ID, quicklook, v1 or entry.
                log.info("Cache miss: directory step \(index) failed, errno \(errno)")
                return nil
            }
            close(directory)
            directory = next
        }
        guard let json = read("entry.json", in: directory, limit: 64 * 1024),
              !json.contains(0), String(data: json, encoding: .utf8) != nil,
              let entry = try? JSONDecoder().decode(Entry.self, from: json),
              entry.isValid, entry.source.utf8.elementsEqual(source.path.utf8),
              source.sha256 == entry.sourceSha256,
              let pdf = read("slides.pdf", in: directory, limit: 50 * 1024 * 1024),
              digest(pdf) == entry.pdfSha256 else {
            log.info("Cache miss: entry or PDF could not be read or validated")
            return nil
        }
        log.info("Cache hit: \(root, privacy: .public)")
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
