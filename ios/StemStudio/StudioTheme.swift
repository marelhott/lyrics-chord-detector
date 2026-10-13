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
