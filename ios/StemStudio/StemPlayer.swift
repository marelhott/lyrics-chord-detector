import AVFoundation
import MediaPlayer
import Observation

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
    private var players: [String: AVAudioPlayer] = [:]
    private var anchor = 0.0
    private var deviceStart = 0.0
    private var observers: [NSObjectProtocol] = []
    private var commands: [(MPRemoteCommand, Any)] = []
    private var title = ""
    private var generation = UUID()

    init() {
        observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.pause() }
        })
        observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] notification in
            let reason = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
            if reason == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue { Task { @MainActor in self?.pause() } }
        })
        let remote = MPRemoteCommandCenter.shared()
        commands.append((remote.playCommand, remote.playCommand.addTarget { [weak self] _ in Task { @MainActor in self?.play() }; return .success }))
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
        let generation = UUID(); self.generation = generation
        stop(); loading = true; loadedCount = 0; error = nil
        title = song.title; duration = result.duration; loopEnd = duration
        var loaded: [String: AVAudioPlayer] = [:]
        do {
            // Stream each compressed file to disk; do not decode the whole song into RAM.
            for name in ["original"] + result.stems {
                let file = try await StudioAPI.shared.audio(id: song.id, name: name)
                try Task.checkCancellation()
                guard self.generation == generation else { return }
                let player = try AVAudioPlayer(contentsOf: file)
                player.enableRate = true; player.prepareToPlay()
                loaded[name] = player; loadedCount += 1
            }
            guard self.generation == generation else { return }
            players = loaded; duration = loaded["original"]?.duration ?? duration; loopEnd = duration
            applyMix(); loading = false
        } catch is CancellationError { if self.generation == generation { loading = false } }
        catch { if self.generation == generation { self.error = error.localizedDescription; loading = false } }
    }
    func applyMix() {
        for (name, player) in players {
            player.volume = original ? (name == "original" ? 1 : 0) : (name == "original" || muted.contains(name) || (solo != nil && solo != name) ? 0 : volumes[name, default: 0.75])
            player.rate = speed
        }
    }
    func play() {
        guard !loading, !players.isEmpty, !playing else { return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            if position >= duration - 0.1 { position = 0 }
            anchor = position
            // One hardware clock for every lane; never seek tracks repeatedly during playback.
            deviceStart = (players["original"]?.deviceCurrentTime ?? 0) + 0.08
            for player in players.values { player.currentTime = position; player.play(atTime: deviceStart) }
            playing = true; nowPlaying()
        } catch { self.error = error.localizedDescription }
    }
    func pause() {
        tick(); players.values.forEach { $0.pause() }; playing = false; nowPlaying()
    }
    func stop() {
        players.values.forEach { $0.stop() }; players.removeAll(); playing = false; position = 0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }
    func seek(_ value: Double) {
        let resume = playing
        players.values.forEach { $0.pause() }; playing = false
        position = min(duration, max(0, value))
        if resume { play() } else { nowPlaying() }
    }
    func setSpeed(_ value: Float) {
        let resume = playing; if resume { pause() }
        speed = value; applyMix(); if resume { play() }
    }
    func tick() {
        guard playing, let master = players["original"] else { return }
        position = min(duration, anchor + max(0, master.deviceCurrentTime - deviceStart) * Double(speed))
        if loop && position >= loopEnd { seek(loopStart) }
        else if position >= duration { players.values.forEach { $0.pause() }; playing = false; nowPlaying() }
    }
    private func nowPlaying() {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [MPMediaItemPropertyTitle: title, MPMediaItemPropertyPlaybackDuration: duration, MPNowPlayingInfoPropertyElapsedPlaybackTime: position, MPNowPlayingInfoPropertyPlaybackRate: playing ? speed : 0]
    }
}
