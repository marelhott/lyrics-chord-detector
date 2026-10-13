import SwiftUI

enum StudioTheme {
    static let background = Color(red: 0.065, green: 0.055, blue: 0.085)
    static let card = Color(red: 0.13, green: 0.10, blue: 0.17)
    static let accent = Color(red: 0.81, green: 0.71, blue: 0.97)
    static let secondary = Color(red: 0.62, green: 0.56, blue: 0.68)
    static let labels = ["vocals": "Zpěv", "drums": "Bicí", "bass": "Basa", "guitar": "Kytara", "piano": "Piano", "other": "Ostatní"]
    static let colors: [String: Color] = ["vocals": .purple, "drums": .orange, "bass": .mint, "guitar": .yellow, "piano": .cyan, "other": .gray]
}
struct OrbArtwork: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 24, paused: reduceMotion)) { context in
            let phase = reduceMotion ? 0.0 : context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 40) / 40 * 360
            ZStack {
                RoundedRectangle(cornerRadius: 24).fill(LinearGradient(colors: [Color(red: 0.25, green: 0.18, blue: 0.33), StudioTheme.card], startPoint: .topLeading, endPoint: .bottomTrailing))
                GeometryReader { geo in
                    let width = geo.size.width
                    ZStack {
                        Circle().fill(RadialGradient(colors: [Color(red: 0.93, green: 0.78, blue: 1), .purple.opacity(0.65), StudioTheme.card], center: .topLeading, startRadius: 0, endRadius: width * 0.5)).frame(width: width * 0.44, height: width * 0.44).shadow(color: .purple.opacity(0.35), radius: 24)
                        ForEach(0..<3) { i in
                            Ellipse().stroke(StudioTheme.accent.opacity(0.65), lineWidth: 0.8).frame(width: width * 0.8, height: width * 0.40).rotationEffect(.degrees(phase + Double(i) * 65))
                        }
                    }.frame(width: width, height: geo.size.height)
                }
            }.clipShape(RoundedRectangle(cornerRadius: 24))
        }.accessibilityHidden(true)
    }
}
struct StudioCard<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View { content.padding(18).background(StudioTheme.card, in: RoundedRectangle(cornerRadius: 20)).overlay(RoundedRectangle(cornerRadius: 20).stroke(.white.opacity(0.06))) }
}
struct Eyebrow: View {
    let text: String
    var body: some View { Text(text.uppercased()).font(.system(size: 10, weight: .semibold)).tracking(2).foregroundStyle(StudioTheme.secondary) }
}
func timeLabel(_ seconds: Double) -> String { String(format: "%d:%02d", max(0, Int(seconds)) / 60, max(0, Int(seconds)) % 60) }

struct AlbumCover: View {
    let artwork: AlbumArtwork?
    var body: some View {
        Group {
            if let artwork, let url = URL(string: artwork.url) {
                AsyncImage(url: url, transaction: Transaction(animation: .easeInOut(duration: 0.45))) { phase in
                    if let image = phase.image { image.resizable().scaledToFill().transition(.opacity) }
                    else { OrbArtwork() }
                }
            } else { OrbArtwork() }
        }.clipShape(RoundedRectangle(cornerRadius: 18)).overlay(RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.08)))
            .accessibilityLabel(artwork.map { "Obal alba " + $0.album } ?? "Skladba")
    }
}
struct ProcessingCard: View {
    let song: Song
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var displayed = 0.0
    private var fraction: Double { min(1, max(0, song.progress ?? 0)) }
    private var stages: [String] { ["Audio", "Stemy", "Akordy", "Text"] }
    private var stageIndex: Int { ["downloading":0, "separating":1, "stems_ready":2, "chords":2, "lyrics":3][song.step] ?? -1 }
    var body: some View {
        StudioCard {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    VStack(alignment: .leading, spacing: 6) {
                        Eyebrow(text: song.result == nil ? "Vznikají tvoje stopy" : "Stopy už můžeš přehrát")
                        Text(song.stepLabel).font(.system(size: 17, weight: .medium, design: .rounded)).contentTransition(.numericText())
                    }
                    Spacer()
                    if stageIndex >= 1 { Text("\(Int(displayed * 100)) %").font(.system(size: 22, weight: .light, design: .rounded)).monospacedDigit().contentTransition(.numericText()).foregroundStyle(StudioTheme.accent) }
                    else { ProgressView().tint(StudioTheme.accent) }
                }
                TimelineView(.animation(minimumInterval: 1.0 / 30, paused: reduceMotion)) { timeline in
                    GeometryReader { geo in
                        let phase = timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 2.4) / 2.4
                        ZStack(alignment: .leading) {
                            Capsule().fill(.white.opacity(0.07))
                            Capsule().fill(LinearGradient(colors: [.purple, StudioTheme.accent, .white.opacity(0.85)], startPoint: .leading, endPoint: .trailing)).frame(width: max(0, geo.size.width * displayed))
                                .overlay(alignment: .leading) {
                                    if !reduceMotion { Rectangle().fill(LinearGradient(colors: [.clear, .white.opacity(0.5), .clear], startPoint: .leading, endPoint: .trailing)).frame(width: 70).offset(x: CGFloat(phase) * (geo.size.width + 70) - 70) }
                                }.clipShape(Capsule()).shadow(color: .purple.opacity(0.4), radius: 9)
                        }
                    }.frame(height: 7)
                }.accessibilityLabel("Průběh zpracování").accessibilityValue("\(Int(fraction * 100)) procent")
                HStack(spacing: 0) {
                    ForEach(Array(stages.enumerated()), id: \.offset) { index, title in
                        HStack(spacing: 5) { Image(systemName: index < stageIndex ? "checkmark.circle.fill" : index == stageIndex ? "circle.inset.filled" : "circle"); Text(title) }.font(.system(size: 11, weight: .medium)).foregroundStyle(index <= stageIndex ? StudioTheme.accent : StudioTheme.secondary.opacity(0.65))
                        if index < 3 { Spacer(minLength: 4) }
                    }
                }
                Text(song.step == "queued" ? "Čekám na volné místo. Zpracování se spustí automaticky." : "Běží v cloudu. Aplikaci můžeš klidně zavřít.").font(.caption).foregroundStyle(StudioTheme.secondary)
            }
        }.onAppear { displayed = fraction }
            .onChange(of: fraction) { _, value in
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 1.2)) { displayed = value }
            }
    }
}
