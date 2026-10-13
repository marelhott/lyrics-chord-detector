import SwiftUI

@main struct StemStudioApp: App {
    @State private var library = LibraryStore()
    var body: some Scene {
        WindowGroup {
            RootView().environment(library).tint(StudioTheme.accent).preferredColorScheme(.dark)
        }
    }
}
struct RootView: View {
    @Environment(LibraryStore.self) private var library
    @State private var password = ""
    @State private var loggingIn = false
    var body: some View {
        ZStack {
            StudioTheme.background.ignoresSafeArea()
            if library.checking { ProgressView("Připojuji studio…") }
            else if library.authenticated { LibraryView() }
            else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        OrbArtwork().frame(width: 170, height: 170).frame(maxWidth: .infinity).padding(.top, 38)
                        Eyebrow(text: "Tvůj soukromý prostor")
                        Text("Každá skladba\nmá víc vrstev.").font(.system(size: 36, weight: .medium, design: .rounded)).tracking(-1.5)
                        Text("Najdi tu svoji.").foregroundStyle(StudioTheme.accent).font(.title2)
                        StudioCard {
                            VStack(alignment: .leading, spacing: 18) {
                                Label("Vítej ve studiu", systemImage: "waveform").font(.headline)
                                SecureField("Přístupové heslo", text: $password).textContentType(.password).submitLabel(.go).onSubmit { login() }
                                if let error = library.error { Text(error).font(.footnote).foregroundStyle(.orange) }
                                Button(action: login) { HStack { Text(loggingIn ? "Přihlašuji…" : "Vstoupit do studia"); Spacer(); Image(systemName: "arrow.up.right") }.padding(.vertical, 6) }.buttonStyle(.borderedProminent).disabled(password.isEmpty || loggingIn)
                            }
                        }
                    }.padding(24)
                }
            }
        }.task { await library.checkSession() }
    }
    private func login() {
        loggingIn = true
        Task {
            defer { loggingIn = false }
            do { try await StudioAPI.shared.login(password); password = ""; library.authenticated = true; library.error = nil }
            catch { library.error = error.localizedDescription }
        }
    }
}
struct LibraryView: View {
    @Environment(LibraryStore.self) private var library
    @Environment(\.scenePhase) private var scenePhase
    @State private var importing = false
    @State private var path: [String] = []
    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    HStack(alignment: .center) {
                        VStack(alignment: .leading, spacing: 8) { Eyebrow(text: "Prostor pro hlubší poslech"); Text("Hudba.\nVrstva po vrstvě.").font(.system(size: 31, weight: .medium, design: .rounded)).tracking(-1.2) }
                        Spacer(); OrbArtwork().frame(width: 100, height: 100)
                    }.padding(.vertical, 8)
                    HStack { Text("Knihovna").font(.title2.weight(.medium)); Spacer(); Text("\(library.songs.count)").foregroundStyle(StudioTheme.secondary) }
                    if let error = library.error { Text(error).font(.footnote).foregroundStyle(.orange) }
                    if library.songs.isEmpty {
                        Button { importing = true } label: { StudioCard { VStack(spacing: 14) { Image(systemName: "waveform").font(.largeTitle); Text("Začni jednou skladbou").font(.headline); Text("Vyber soubor nebo najdi skladbu.").font(.subheadline).foregroundStyle(StudioTheme.secondary) }.frame(maxWidth: .infinity).padding(.vertical, 24) } }.buttonStyle(.plain)
                    }
                    ForEach(library.songs) { song in
                        Button { path.append(song.id) } label: {
                            StudioCard { HStack(spacing: 16) { OrbArtwork().frame(width: 60, height: 60); VStack(alignment: .leading, spacing: 6) { Text(song.title).font(.system(size: 15, weight: .medium)).lineLimit(2).foregroundStyle(.white); Label(song.stepLabel, systemImage: song.processing ? "hourglass" : song.status == "ready" ? "waveform" : "exclamationmark.circle").font(.caption).foregroundStyle(song.status == "ready" ? Color.mint : StudioTheme.accent) }; Spacer(minLength: 0); Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(StudioTheme.secondary) } }
                        }.buttonStyle(.plain)
                    }
                }.padding(22)
            }.background(StudioTheme.background)
            .navigationTitle("stem studio").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { importing = true } label: { Image(systemName: "plus").font(.headline) }.accessibilityLabel("Přidat skladbu") } }
            .navigationDestination(for: String.self) { PlayerView(id: $0) }
            .refreshable { await library.refresh() }
            .task(id: scenePhase) {
                guard scenePhase == .active else { return }
                repeat { await library.refresh(); try? await Task.sleep(for: .seconds(4)) } while !Task.isCancelled
            }
            .sheet(isPresented: $importing) { ImportView { id in importing = false; path.append(id); Task { await library.refresh() } } }
        }
    }
}
