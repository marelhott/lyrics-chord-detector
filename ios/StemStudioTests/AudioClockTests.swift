import XCTest
import AVFoundation
@testable import StemStudio

@MainActor final class AudioClockTests: XCTestCase {
    func testSharedClockSeekRateAndPause() async throws {
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".wav")
        defer { try? FileManager.default.removeItem(at: file) }
        let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2)!
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 44100 * 4)!
        buffer.frameLength = buffer.frameCapacity
        for channel in 0..<2 {
            for frame in 0..<Int(buffer.frameLength) { buffer.floatChannelData![channel][frame] = Float(sin(Double(frame) * 2 * .pi * 220 / 44100)) * 0.001 }
        }
        do { let output = try AVAudioFile(forWriting: file, settings: format.settings); try output.write(from: buffer) }
        let player = StemPlayer()
        try player.configureLocalFiles(["original":file,"vocals":file,"drums":file,"bass":file,"guitar":file,"piano":file,"other":file], title: "Clock test")
        await player.play()
        XCTAssertTrue(player.playing, player.error ?? "")
        try await Task.sleep(for: .milliseconds(400))
        player.tick()
        XCTAssertGreaterThan(player.position, 0.2)
        assertSynchronized(player)
        player.seek(1.0)
        try await Task.sleep(for: .milliseconds(250))
        player.tick()
        XCTAssertGreaterThan(player.position, 1)
        assertSynchronized(player)
        player.setSpeed(0.8)
        try await Task.sleep(for: .milliseconds(250))
        assertSynchronized(player)
        player.pause()
        let paused = player.lanePositions
        try await Task.sleep(for: .milliseconds(150))
        for (name, time) in paused { XCTAssertEqual(player.lanePositions[name]!, time, accuracy: 0.01) }
        player.seek(2)
        XCTAssertEqual(player.position, 2, accuracy: 0.01)
        player.stop()
    }
    private func assertSynchronized(_ player: StemPlayer, file: StaticString = #filePath, line: UInt = #line) {
        let times = Array(player.lanePositions.values)
        XCTAssertEqual(times.count, 7, file: file, line: line)
        XCTAssertLessThan((times.max() ?? 0) - (times.min() ?? 0), 0.02, "Tracks drifted", file: file, line: line)
    }
}
