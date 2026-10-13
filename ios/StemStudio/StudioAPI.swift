import Foundation
import Observation

struct Session: Decodable { let authenticated: Bool }
struct CreatedSong: Decodable { let id: String }
struct SearchResponse: Decodable { let items: [SearchItem] }
struct SearchItem: Decodable, Identifiable {
    var id: String { url }
    let title: String
    let artist: String
    let url: String
    let duration: Double?
    let importable: Bool
}
struct Chord: Decodable { let chord: String; let start: Double; let end: Double }
struct Word: Decodable { let word: String; let start: Double; let end: Double }
struct SongResult: Decodable {
    let duration: Double
    let stems: [String]
    let waveforms: [String: [Double]]?
    let chords: [Chord]
    let words: [Word]
    let key: String
    let warnings: [String]
    let analysis: [String: String]?
}
struct Song: Decodable, Identifiable {
    let id: String
    let title: String
    let status: String
    let step: String
    let error: String?
    let result: SongResult?
    var processing: Bool { status == "running" || status == "queued" }
    var stepLabel: String {
        ["queued": "Čeká ve frontě", "downloading": "Získávám audio", "separating": "Odděluji nástroje", "chords": "Počítám akordy", "lyrics": "Přepisuji zpěv", "ready": "Připraveno", "failed": "Zpracování selhalo"][step] ?? step
    }
}
struct StudioError: LocalizedError { let message: String; var errorDescription: String? { message } }

actor StudioAPI {
    static let shared = StudioAPI()
    let base = URL(string: "https://lyricschorddetector.up.railway.app")!
    private let session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 60
        configuration.httpCookieStorage = .shared
        return URLSession(configuration: configuration)
    }()
    func request<T: Decodable>(_ path: String, method: String = "GET", data: Data? = nil, contentType: String? = nil) async throws -> T {
        var request = URLRequest(url: base.appendingPathComponent("api" + path))
        request.httpMethod = method
        request.httpBody = data
        if let contentType { request.setValue(contentType, forHTTPHeaderField: "Content-Type") }
        let (bytes, response) = try await session.data(for: request)
        try validate(response, bytes)
        return try JSONDecoder().decode(T.self, from: bytes)
    }
    private func validate(_ response: URLResponse, _ data: Data) throws {
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else {
            let detail = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["detail"] as? String
            throw StudioError(message: detail ?? "Server neodpověděl. Zkus to znovu.")
        }
    }
    func login(_ password: String) async throws {
        let _: Session = try await request("/session", method: "POST", data: JSONSerialization.data(withJSONObject: ["password": password]), contentType: "application/json")
    }
    func search(_ query: String, source: String) async throws -> [SearchItem] {
        var parts = URLComponents(url: base.appendingPathComponent("api/search"), resolvingAgainstBaseURL: false)!
        parts.queryItems = [URLQueryItem(name: "q", value: query), URLQueryItem(name: "source", value: source)]
        let (bytes, response) = try await session.data(from: parts.url!)
        try validate(response, bytes)
        return try JSONDecoder().decode(SearchResponse.self, from: bytes).items
    }
    func add(url: String = "", file: URL? = nil, language: String = "auto", title: String = "") async throws -> String {
        let boundary = UUID().uuidString
        var body = Data()
        func field(_ name: String, _ value: String) {
            body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".utf8))
        }
        field("language", language); field("title", title)
        if let file {
            let access = file.startAccessingSecurityScopedResource()
            defer { if access { file.stopAccessingSecurityScopedResource() } }
            let attributes = try FileManager.default.attributesOfItem(atPath: file.path)
            guard (attributes[.size] as? NSNumber)?.intValue ?? 0 <= 80 * 1024 * 1024 else { throw StudioError(message: "Maximum je 80 MB.") }
            let name = file.lastPathComponent.replacingOccurrences(of: "\"", with: "").replacingOccurrences(of: "\r", with: "").replacingOccurrences(of: "\n", with: "")
            body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"file\"; filename=\"\(name)\"\r\nContent-Type: application/octet-stream\r\n\r\n".utf8))
            body.append(try Data(contentsOf: file)); body.append(Data("\r\n".utf8))
        } else { field("url", url) }
        body.append(Data("--\(boundary)--\r\n".utf8))
        let created: CreatedSong = try await request("/songs", method: "POST", data: body, contentType: "multipart/form-data; boundary=\(boundary)")
        return created.id
    }
    func audio(id: String, name: String) async throws -> URL {
        let folder = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("Audio/\(id)")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let target = folder.appendingPathComponent(name + ".mp3")
        if FileManager.default.fileExists(atPath: target.path) { return target }
        let (temporary, response) = try await session.download(from: base.appendingPathComponent("api/songs/\(id)/audio/\(name)"))
        try validate(response, (try? Data(contentsOf: temporary)) ?? Data())
        try Task.checkCancellation()
        try FileManager.default.moveItem(at: temporary, to: target)
        return target
    }
}

@MainActor @Observable final class LibraryStore {
    var songs: [Song] = []
    var authenticated = false
    var checking = true
    var error: String?
    func checkSession() async {
        defer { checking = false }
        do { let value: Session = try await StudioAPI.shared.request("/session"); authenticated = value.authenticated }
        catch { self.error = error.localizedDescription }
    }
    func refresh() async {
        do { songs = try await StudioAPI.shared.request("/songs"); error = nil }
        catch is CancellationError {} catch { self.error = error.localizedDescription }
    }
}
