import SwiftUI
import UniformTypeIdentifiers

struct ImportView: View {
    @Environment(\.dismiss) private var dismiss
    let onCreated: (String) -> Void
    @State private var mode = "Hledat"
    @State private var source = "youtube"
    @State private var query = ""
    @State private var url = ""
    @State private var language = "auto"
    @State private var results: [SearchItem] = []
    @State private var busy = false
    @State private var filePicker = false
    @State private var error: String?
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Eyebrow(text: "Začíná to jednou skladbou")
                    Text("Poslechni si ji jinak.").font(.system(size: 30, weight: .medium, design: .rounded)).tracking(-1)
                    Picker("Přidání skladby", selection: $mode) { ForEach(["Hledat", "Odkaz", "Soubor"], id: \.self) { Text($0) } }.pickerStyle(.segmented).disabled(busy)
                    Picker("Jazyk zpěvu", selection: $language) { Text("Automaticky").tag("auto"); Text("Čeština").tag("cs"); Text("Angličtina").tag("en"); Text("Slovenština").tag("sk") }.disabled(busy)
                    if mode == "Hledat" {
                        Picker("Zdroj", selection: $source) { Text("YouTube").tag("youtube"); Text("SoundCloud").tag("soundcloud") }.pickerStyle(.segmented).disabled(busy)
                        HStack { TextField("Název skladby nebo interpret", text: $query).submitLabel(.search).onSubmit { search() }; Button(action: search) { Image(systemName: "magnifyingglass") }.disabled(query.trimmingCharacters(in: .whitespaces).count < 2 || busy) }.padding(16).background(StudioTheme.card, in: RoundedRectangle(cornerRadius: 14))
                        ForEach(results) { item in
                            Button { add(url: item.url, title: item.title) } label: { StudioCard { HStack { VStack(alignment: .leading, spacing: 6) { Text(item.title).font(.subheadline.weight(.medium)).foregroundStyle(.white); Text(item.artist + (item.duration.map { " · " + timeLabel($0) } ?? "")).font(.caption).foregroundStyle(StudioTheme.secondary) }; Spacer(); Image(systemName: "plus.circle.fill").font(.title2) } } }.buttonStyle(.plain).disabled(busy || !item.importable)
                        }
                    } else if mode == "Odkaz" {
                        TextField("https://youtube.com/watch?v=…", text: $url).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled().padding(16).background(StudioTheme.card, in: RoundedRectangle(cornerRadius: 14))
                        Button("Otevřít skladbu") { add(url: url) }.buttonStyle(.borderedProminent).disabled(url.isEmpty || busy)
                        Text("YouTube a SoundCloud. Některé zdroje mohou cloudové stažení odmítnout.").font(.footnote).foregroundStyle(StudioTheme.secondary)
                    } else {
                        Button { filePicker = true } label: { StudioCard { VStack(spacing: 14) { Image(systemName: "arrow.up.doc").font(.largeTitle); Text("Vyber audio ze souborů"); Text("Do 80 MB / 10 minut").font(.caption).foregroundStyle(StudioTheme.secondary) }.frame(maxWidth: .infinity).padding(.vertical, 26) } }.buttonStyle(.plain).disabled(busy)
                    }
                    if busy { ProgressView("Pracuji…") }
                    if let error { Text(error).font(.footnote).foregroundStyle(.orange) }
                    Text("Zpracování běží na tvém Railway backendu. Aplikaci můžeš mezitím zavřít.").font(.footnote).foregroundStyle(StudioTheme.secondary)
                }.padding(24)
            }.background(StudioTheme.background).navigationTitle("Nová skladba").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Hotovo") { dismiss() }.disabled(busy) } }
                .interactiveDismissDisabled(busy)
                .fileImporter(isPresented: $filePicker, allowedContentTypes: [.audio, .movie]) { result in
                    switch result { case .success(let file): add(file: file); case .failure(let failure): error = failure.localizedDescription }
                }
        }
    }
    private func search() {
        busy = true; error = nil
        Task { defer { busy = false }; do { results = try await StudioAPI.shared.search(query.trimmingCharacters(in: .whitespaces), source: source) } catch { self.error = error.localizedDescription } }
    }
    private func add(url: String = "", file: URL? = nil, title: String = "") {
        busy = true; error = nil
        Task { defer { busy = false }; do { onCreated(try await StudioAPI.shared.add(url: url.trimmingCharacters(in: .whitespacesAndNewlines), file: file, language: language, title: title)) } catch { self.error = error.localizedDescription } }
    }
}
