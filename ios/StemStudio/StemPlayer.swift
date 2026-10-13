import AVFoundation
import MediaPlayer
import Observation

private actor AudioSessionActivator {
    static let shared = AudioSessionActivator()
    func activate() throws {
        try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try AVAudioSession.sharedInstance().setActive(true)
    }
}

@MainActor @Observable final class StemPlayer {
    var playing = false
    var loading = false
    var loadedCount = 0
    var position = 0.0
    var duration = 0.0
    var error: String?
    var volumes: [String: Float] = [:]
    var muted: Set<String> = []
    var solo: String?
    var original = false
    var speed: Float = 1
    var loop = false
    var loopStart = 0.0
    var loopEnd = 0.0
    private let engine = AVAudioEngine()
    private let mixer = AVAudioMixerNode()
    private let pitch = AVAudioUnitTimePitch()
    private var players: [String: AVAudioPlayerNode] = [:]
    private var files: [String: AVAudioFile] = [:]
    private var anchor = 0.0
    private var activating = false
    private var sessionActive = false
    private var observers: [NSObjectProtocol] = []
    private var commands: [(MPRemoteCommand, Any)] = []
    private var title = ""
    private var generation = UUID()

    init() {
        engine.attach(mixer)
        engine.attach(pitch)
        observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.pause(); self?.sessionActive = false }
        })
        observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] notification in
            let reason = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
            if reason == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue { Task { @MainActor in self?.pause() } }
        })
        let remote = MPRemoteCommandCenter.shared()
        commands.append((remote.playCommand, remote.playCommand.addTarget { [weak self] _ in Task { @MainActor in await self?.play() }; return .success }))
        commands.append((remote.pauseCommand, remote.pauseCommand.addTarget { [weak self] _ in Task { @MainActor in self?.pause() }; return .success }))
        commands.append((remote.changePlaybackPositionCommand, remote.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            Task { @MainActor in self?.seek(event.positionTime) }; return .success
        }))
    }
    isolated deinit {
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
        for (command, target) in commands { command.removeTarget(target) }
    }
    func load(_ song: Song) async {
        guard let result = song.result else { return }
        stop()
        let generation = UUID(); self.generation = generation
        loading = true; loadedCount = 0; error = nil
        title = song.title; duration = result.duration; loopEnd = duration
        var loaded: [String: URL] = [:]
        do {
            // Stream each compressed file to disk; do not decode the whole song into RAM.
            for name in ["original"] + result.stems {
                let file = try await StudioAPI.shared.audio(id: song.id, name: name)
                try Task.checkCancellation()
                guard self.generation == generation else { return }
                loaded[name] = file; loadedCount += 1
            }
            guard self.generation == generation else { return }
            try configureLocalFiles(loaded, title: song.title)
            loading = false
        } catch is CancellationError { if self.generation == generation { loading = false } }
        catch { if self.generation == generation { self.error = error.localizedDescription; loading = false } }
    }
    func applyMix() {
        for (name, player) in players {
            player.volume = original ? (name == "original" ? 1 : 0) : (name == "original" || muted.contains(name) || (solo != nil && solo != name) ? 0 : volumes[name, default: 0.75])
        }
        pitch.rate = speed
    }
    func configureLocalFiles(_ urls: [String: URL], title: String) throws {
        stop(invalidate: false)
        self.title = title
        for (name, url) in urls { files[name] = try AVAudioFile(forReading: url) }
        guard let master = files["original"] ?? files.values.first else { return }
        let format = master.processingFormat
        engine.connect(mixer, to: pitch, format: format)
        engine.connect(pitch, to: engine.mainMixerNode, format: format)
        for (bus, name) in files.keys.sorted().enumerated() {
            let node = AVAudioPlayerNode()
            engine.attach(node)
            engine.connect(node, to: mixer, fromBus: 0, toBus: AVAudioNodeBus(bus), format: files[name]!.processingFormat)
            players[name] = node
        }
        duration = Double(master.length) / format.sampleRate
        loopEnd = duration
        engine.prepare()
        applyMix()
    }
    #if DEBUG
    var lanePositions: [String: Double] {
        players.mapValues { node in
            guard playing, let render = node.lastRenderTime, let time = node.playerTime(forNodeTime: render) else { return position }
            return anchor + Double(time.sampleTime) / time.sampleRate
        }
    }
    #endif
    func play() async {
        guard !loading, !players.isEmpty, !playing, !activating else { return }
        activating = true
        let generation = self.generation
        defer { activating = false }
        do {
            if !sessionActive { try await AudioSessionActivator.shared.activate(); sessionActive = true }
            guard generation == self.generation, !players.isEmpty else { return }
            if position >= duration - 0.1 { position = 0 }
            try startAtPosition()
        } catch { self.error = error.localizedDescription }
    }
    private func startAtPosition() throws {
        if !engine.isRunning { try engine.start() }
        anchor = position
        let start = AVAudioTime(hostTime: mach_absolute_time() + AVAudioTime.hostTime(forSeconds: 0.08))
        for (name, node) in players {
            guard let file = files[name] else { continue }
            node.stop()
            let offset = min(file.length, AVAudioFramePosition(position * file.processingFormat.sampleRate))
            let remaining = file.length - offset
            guard remaining > 0 else { continue }
            node.scheduleSegment(file, startingFrame: offset, frameCount: AVAudioFrameCount(remaining), at: nil)
            node.play(at: start)
        }
        playing = true
        nowPlaying()
    }
    func pause() {
        tick(); players.values.forEach { $0.stop() }; playing = false; nowPlaying()
    }
    func stop(invalidate: Bool = true) {
        if invalidate { generation = UUID() }
        engine.stop()
        players.values.forEach { $0.stop(); engine.detach($0) }
        players.removeAll(); files.removeAll(); playing = false; position = 0
        engine.disconnectNodeOutput(mixer)
        engine.disconnectNodeOutput(pitch)
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }
    func seek(_ value: Double) {
        let resume = playing
        players.values.forEach { $0.stop() }; playing = false
        position = min(duration, max(0, value))
        if resume { do { try startAtPosition() } catch { self.error = error.localizedDescription } } else { nowPlaying() }
    }
    func setSpeed(_ value: Float) {
        let resume = playing; if resume { pause() }
        speed = value; applyMix(); if resume { do { try startAtPosition() } catch { self.error = error.localizedDescription } }
    }
    func tick() {
        guard playing, let master = players["original"], let render = master.lastRenderTime, let time = master.playerTime(forNodeTime: render) else { return }
        position = min(duration, anchor + max(0, Double(time.sampleTime) / time.sampleRate))
        if loop && position >= loopEnd { seek(loopStart) }
        else if position >= duration { players.values.forEach { $0.stop() }; playing = false; nowPlaying() }
    }
    private func nowPlaying() {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [MPMediaItemPropertyTitle: title, MPMediaItemPropertyPlaybackDuration: duration, MPNowPlayingInfoPropertyElapsedPlaybackTime: position, MPNowPlayingInfoPropertyPlaybackRate: playing ? speed : 0]
    }
}
