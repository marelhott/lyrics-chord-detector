import SwiftUI

struct PlayerView: View {
    let id: String
    @Environment(\.scenePhase) private var scenePhase
    @State private var song: Song?
    @State private var player = StemPlayer()
    @State private var panel = "Stemy"
    @State private var fetchError: String?
    @State private var prepared = false
    @State private var scrubbing = false
    @State private var scrubPosition = 0.0
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if let song {
                    HStack(spacing: 18) { OrbArtwork().frame(width: 90, height: 90); VStack(alignment: .leading, spacing: 8) { Eyebrow(text: "Uvnitř skladby"); Text(song.title).font(.system(size: 22, weight: .medium, design: .rounded)).tracking(-0.6).lineLimit(3); if let result = song.result { Text("\(timeLabel(result.duration)) · \(result.stems.count) stop · \(result.key)").font(.caption).foregroundStyle(StudioTheme.secondary) } } }
                    if song.processing { Label(song.result == nil ? song.stepLabel : "Stemy připravené · " + song.stepLabel, systemImage: "hourglass").font(.footnote).foregroundStyle(StudioTheme.accent) }
                    if let result = song.result {
                        if player.loading { ProgressView("Načítám stopy \(player.loadedCount) / \(result.stems.count + 1)").font(.footnote) }
                        if let error = player.error { Text(error).foregroundStyle(.orange).font(.footnote); Button("Načíst znovu") { Task { await player.load(song) } } }
                        Picker("Panel", selection: $panel) { ForEach(["Stemy", "Akordy", "Text"], id: \.self) { Text($0) } }.pickerStyle(.segmented)
                        if panel == "Stemy" { stems(result) }
                        else if panel == "Akordy" { chords(result) }
                        else { lyrics(result) }
                        ForEach(result.warnings, id: \.self) { Text($0).font(.caption).foregroundStyle(StudioTheme.secondary) }
                    } else if song.status == "failed" {
                        Text(song.error ?? "Zpracování selhalo.").foregroundStyle(.orange)
                        Button("Zkusit znovu") { Task { do { let _: CreatedSong = try await StudioAPI.shared.request("/songs/\(id)/retry", method: "POST"); await refresh() } catch { fetchError = error.localizedDescription } } }.buttonStyle(.borderedProminent)
                    } else { ProgressView().frame(maxWidth: .infinity).padding(40); Text("Oddělení běží v cloudu. Skladba zůstane v knihovně, i když aplikaci zavřeš.").font(.subheadline).foregroundStyle(StudioTheme.secondary) }
                } else { ProgressView("Načítám skladbu…").frame(maxWidth: .infinity).padding(50) }
                if let fetchError { Text(fetchError).font(.footnote).foregroundStyle(.orange) }
            }.padding(22)
        }.background(StudioTheme.background).navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom, spacing: 0) { if song?.result != nil { transport } }
            .task(id: scenePhase) {
                guard scenePhase == .active else { return }
                repeat { await refresh(); if song?.processing != true { break }; try? await Task.sleep(for: .seconds(3)) } while !Task.isCancelled
            }
            .task {
                while !Task.isCancelled { player.tick(); try? await Task.sleep(for: .milliseconds(80)) }
            }
            .task(id: song?.result != nil) {
                if !prepared, let song, song.result != nil { prepared = true; await player.load(song) }
            }
            .onDisappear { player.stop() }
    }
    private func refresh() async {
        do { song = try await StudioAPI.shared.request("/songs/\(id)"); fetchError = nil }
        catch is CancellationError {} catch { fetchError = error.localizedDescription }
    }
    private func stems(_ result: SongResult) -> some View {
        VStack(spacing: 10) {
            Toggle("Poslech originálu", isOn: $player.original).font(.subheadline).onChange(of: player.original) { player.applyMix() }.padding(.bottom, 8)
            ForEach(result.stems, id: \.self) { name in
                let color = StudioTheme.colors[name] ?? StudioTheme.accent
                StudioCard {
                    VStack(spacing: 10) {
                        HStack {
                            Image(systemName: "waveform").foregroundStyle(color)
                            Text(StudioTheme.labels[name] ?? name).font(.subheadline.weight(.medium))
                            Spacer()
                            Button { if player.muted.contains(name) { player.muted.remove(name) } else { player.muted.insert(name) }; player.applyMix() } label: { Text("M").font(.caption.bold()).frame(width: 40, height: 36).background(player.muted.contains(name) ? color : Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 9)).foregroundStyle(player.muted.contains(name) ? Color.black : .white) }.accessibilityLabel("Ztlumit \(StudioTheme.labels[name] ?? name)")
                            Button { player.solo = player.solo == name ? nil : name; player.applyMix() } label: { Text("S").font(.caption.bold()).frame(width: 40, height: 36).background(player.solo == name ? color : Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 9)).foregroundStyle(player.solo == name ? Color.black : .white) }.accessibilityLabel("Solo \(StudioTheme.labels[name] ?? name)")
                        }
                        NativeWaveform(peaks: result.waveforms?[name] ?? [], color: color, progress: player.duration > 0 ? player.position / player.duration : 0).frame(height: 24)
                        Slider(value: Binding(get: { Double(player.volumes[name, default: 0.75]) }, set: { player.volumes[name] = Float($0); player.applyMix() }), in: 0...1).tint(color).accessibilityLabel("Hlasitost \(StudioTheme.labels[name] ?? name)")
                    }
                }.opacity(player.muted.contains(name) || (player.solo != nil && player.solo != name) ? 0.45 : 1)
            }
        }
    }
    private func chords(_ result: SongResult) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Základní odhad dur/moll. Klepnutím skočíš na dané místo.").font(.footnote).foregroundStyle(StudioTheme.secondary)
            if result.analysis?["chords"] == "pending" { ProgressView("Počítám akordy…") }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 70))], spacing: 12) {
                ForEach(Array(result.chords.enumerated()), id: \.offset) { _, chord in
                    if chord.chord != "N" {
                        Button { player.seek(chord.start) } label: { VStack(spacing: 10) { Text(chord.chord).font(.title3.weight(.medium)); Text(timeLabel(chord.start)).font(.caption2) }.frame(maxWidth: .infinity).padding(.vertical, 16).background(player.position >= chord.start && player.position < chord.end ? StudioTheme.accent : StudioTheme.card, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(player.position >= chord.start && player.position < chord.end ? Color.black : StudioTheme.accent) }
                    }
                }
            }
        }
    }
    private func lyrics(_ result: SongResult) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            if result.analysis?["lyrics"] == "pending" { ProgressView("Přepisuji zpěv…") }
            else if result.words.isEmpty { Text("Zpěv se nepodařilo rozpoznat.").foregroundStyle(StudioTheme.secondary) }
            WordFlow {
                ForEach(Array(result.words.enumerated()), id: \.offset) { _, word in
                    Button { player.seek(word.start) } label: { Text(word.word).font(.body).padding(.horizontal, 4).padding(.vertical, 8).background(player.position >= word.start && player.position < word.end ? StudioTheme.accent : .clear, in: RoundedRectangle(cornerRadius: 6)).foregroundStyle(player.position >= word.start && player.position < word.end ? Color.black : .white.opacity(0.8)) }
                }
            }
        }
    }
    private var transport: some View {
        VStack(spacing: 6) {
            Slider(value: Binding(get: { scrubbing ? scrubPosition : player.position }, set: { scrubPosition = $0 }), in: 0...max(0.1, player.duration), onEditingChanged: { editing in if editing { scrubPosition = player.position; scrubbing = true } else { player.seek(scrubPosition); scrubbing = false } }).accessibilityLabel("Pozice přehrávání")
            HStack(spacing: 20) {
                Button { player.playing ? player.pause() : player.play() } label: { Image(systemName: player.playing ? "pause.fill" : "play.fill").font(.title2).frame(width: 52, height: 52).background(StudioTheme.accent, in: Circle()).foregroundStyle(.black) }.accessibilityLabel(player.playing ? "Pozastavit" : "Přehrát").disabled(player.loading || player.error != nil)
                VStack(alignment: .leading, spacing: 4) { Text(timeLabel(scrubbing ? scrubPosition : player.position)).font(.system(.subheadline, design: .monospaced)); Text(timeLabel(player.duration)).font(.caption).foregroundStyle(StudioTheme.secondary) }
                Spacer()
                Button { player.loop.toggle() } label: { Image(systemName: "repeat").foregroundStyle(player.loop ? StudioTheme.accent : StudioTheme.secondary).frame(width: 38, height: 44) }.accessibilityLabel("Opakovat úsek")
                Menu { ForEach([0.5, 0.65, 0.8, 1.0, 1.2], id: \.self) { speed in Button("\(speed.formatted())×") { player.setSpeed(Float(speed)) } } } label: { Text("\(Double(player.speed).formatted())×").font(.subheadline.weight(.medium)).frame(minWidth: 44, minHeight: 44) }
            }
            if player.loop {
                HStack { Button("Od \(timeLabel(player.loopStart))") { player.loopStart = min(player.position, player.loopEnd - 1) }; Spacer(); Button("Do \(timeLabel(player.loopEnd))") { player.loopEnd = max(player.position, player.loopStart + 1) } }.font(.caption).padding(.top, 5)
            }
        }.padding(.horizontal, 24).padding(.top, 10).padding(.bottom, 8).background(StudioTheme.card)
    }
}
struct NativeWaveform: View {
    let peaks: [Double]
    let color: Color
    let progress: Double
    var body: some View {
        Canvas { context, size in
            let count = max(1, peaks.count)
            for (i, peak) in peaks.enumerated() {
                let height = 2 + peak * (size.height - 2)
                let rect = CGRect(x: Double(i) / Double(count) * size.width, y: (size.height - height) / 2, width: max(1, size.width / Double(count) * 0.55), height: height)
                context.fill(Path(roundedRect: rect, cornerRadius: 1), with: .color(color.opacity(Double(i) / Double(count) < progress ? 1 : 0.4)))
            }
        }.accessibilityHidden(true)
    }
}
struct WordFlow: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { arrange(width: proposal.width ?? 300, subviews: subviews).size }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(width: bounds.width, subviews: subviews)
        for (index, point) in result.points.enumerated() { subviews[index].place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), proposal: .unspecified) }
    }
    private func arrange(width: CGFloat, subviews: Subviews) -> (size: CGSize, points: [CGPoint]) {
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0
        var points: [CGPoint] = []
        for view in subviews { let size = view.sizeThatFits(.unspecified); if x > 0 && x + size.width > width { x = 0; y += row; row = 0 }; points.append(CGPoint(x: x, y: y)); x += size.width + 2; row = max(row, size.height) }
        return (CGSize(width: width, height: y + row), points)
    }
}
