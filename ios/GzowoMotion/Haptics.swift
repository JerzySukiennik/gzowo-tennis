// Gzowo Motion haptics: transient Core Haptics taps driven by the game.
import AVFoundation
import CoreHaptics

final class Haptics {
    private var engine: CHHapticEngine?

    init() {
        try? AVAudioSession.sharedInstance().setAllowHapticsAndSystemSoundsDuringRecording(true)
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        do {
            let e = try CHHapticEngine()
            e.playsHapticsOnly = true
            e.isAutoShutdownEnabled = false
            e.resetHandler = { [weak self] in try? self?.engine?.start() }
            e.stoppedHandler = { [weak self] _ in
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { try? self?.engine?.start() }
            }
            try e.start()
            engine = e
        } catch {
            engine = nil
        }
    }

    func play(_ intensity: Float, _ sharpness: Float) {
        guard let engine else { return }
        let event = CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: max(0, min(1, intensity))),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: max(0, min(1, sharpness))),
            ],
            relativeTime: 0
        )
        guard let pattern = try? CHHapticPattern(events: [event], parameters: []),
              let player = try? engine.makePlayer(with: pattern) else { return }
        try? player.start(atTime: CHHapticTimeImmediate)
    }
}
